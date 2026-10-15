const AppError = require("../../shared/utils/AppError");
const collegeRepository = require("./college.repository");
const userService = require("../user/user.service");
const { runAsCollege, runAsPlatform, toId } = require("../../shared/tenancy/context");
const { resolveFeatures, FEATURE_KEYS } = require("../../shared/tenancy/features");

// ── Lookup (every request resolves its caller's college) ──────────────────
// One process serves everything, so a short cache plus explicit invalidation
// on every write keeps suspensions and switch changes immediate.
const CACHE_MS = 30 * 1000;
const cache = new Map();

const getCollege = async (id) => {
  const key = toId(id);
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.college;
  const college = await collegeRepository.findById(key);
  cache.set(key, { college, at: Date.now() });
  return college;
};

const forget = (id) => cache.delete(toId(id));

/** What the API tells a signed-in user about their college. */
const toSummary = (college) =>
  college
    ? {
        id: college._id,
        name: college.name,
        code: college.code,
        status: college.status,
        features: resolveFeatures(college.features),
      }
    : null;

const SUSPENDED_MESSAGE = "Proctavo access for your college is paused — please contact your exam cell.";
const UNLINKED_MESSAGE = "This account isn't linked to a college — please contact your exam cell.";

/**
 * The college a user works in: `null` for the superadmin (platform-level),
 * otherwise an active College. Throws `status` (403 at sign-in, 401 on a live
 * session so the app signs out) for a missing or suspended college.
 */
const resolveUserCollege = async (user, status = 403) => {
  if (!user.college) {
    if ((user.roles || []).includes("superadmin")) return null;
    throw new AppError(UNLINKED_MESSAGE, status);
  }
  const college = await getCollege(user.college);
  if (!college) throw new AppError(UNLINKED_MESSAGE, status);
  if (college.status !== "active") throw new AppError(SUSPENDED_MESSAGE, status);
  return college;
};

// ── Running work per college ───────────────────────────────────────────────

/**
 * Run `fn(college)` once per active college, each inside that college's scope.
 * One college failing doesn't stop the others. Background jobs use this —
 * a sweep must never see two colleges at once.
 */
const forEachActiveCollege = async (label, fn) => {
  const colleges = await runAsPlatform(() => collegeRepository.findActive());
  const results = [];
  for (const college of colleges) {
    try {
      results.push(await runAsCollege(college, () => fn(college)));
    } catch (err) {
      console.error(`[${label}] ${college.code}: ${err.message}`);
    }
  }
  return results;
};

/** Run `fn` in the scope of the college `userId` belongs to (no-op if none). */
const runAsUsersCollege = async (userId, fn) => {
  const collegeId = await runAsPlatform(() => userService.getCollegeIdOf(userId));
  if (!collegeId) return undefined;
  const college = await getCollege(collegeId);
  if (!college) return undefined;
  return runAsCollege(college, fn);
};

// ── Superadmin: colleges ───────────────────────────────────────────────────

const cleanFeatures = (features) => {
  if (features === undefined) return undefined;
  if (!features || typeof features !== "object") throw new AppError("features must be an object", 400);
  const out = {};
  for (const [key, value] of Object.entries(features)) {
    if (!FEATURE_KEYS.includes(key)) throw new AppError(`Unknown feature "${key}"`, 400);
    if (typeof value !== "boolean") throw new AppError(`Feature "${key}" must be true or false`, 400);
    out[key] = value;
  }
  return out;
};

const withCounts = async (colleges) => {
  const [teachers, exams, upcoming] = await Promise.all([
    userService.countByCollege(),
    require("../exam/examGroup.service").countByCollege(),
    require("../duty/duty.service").countUpcomingByCollege(),
  ]);
  return colleges.map((c) => {
    const id = String(c._id);
    return {
      ...toSummary(c),
      createdAt: c.createdAt,
      counts: { teachers: teachers[id] || 0, exams: exams[id] || 0, upcomingDuties: upcoming[id] || 0 },
    };
  });
};

const listColleges = async () => withCounts(await collegeRepository.findAll());

const requireCollege = async (id) => {
  const college = await collegeRepository.findById(id);
  if (!college) throw new AppError("College not found", 404);
  return college;
};

const getCollegeDetail = async (id) => {
  const college = await requireCollege(id);
  const [summary] = await withCounts([college]);
  const csAccounts = await runAsCollege(college, () => userService.getAllUsers({ role: "cs", includeInactive: "true" }));
  return { ...summary, csAccounts };
};

/**
 * Create a college together with its first CS, so it is usable straight away.
 * The CS email is checked up front (emails are unique platform-wide); if the
 * account still fails, the empty college is removed again.
 */
const createCollege = async ({ name, code, features, cs } = {}, actor) => {
  if (!cs || !cs.email || !cs.name || !cs.password || !cs.phone) {
    throw new AppError("The college's first CS needs a name, email, phone and password", 400);
  }
  if (String(cs.password).length < 6) throw new AppError("Password must be at least 6 characters", 400);
  if (await userService.emailExists(cs.email)) {
    throw new AppError("That email already has a Proctavo account", 409);
  }
  const college = await collegeRepository.create({
    name,
    code,
    features: cleanFeatures(features) || {},
    createdBy: actor ? actor.id : null,
  });
  try {
    await runAsCollege(college, () =>
      userService.createUser({ ...cs, designation: "Other", roles: ["cs"], department: cs.department || "Exam cell" })
    );
  } catch (err) {
    await collegeRepository.deleteById(college._id);
    throw err;
  }
  return getCollegeDetail(college._id);
};

const updateCollege = async (id, { name, code, status, features } = {}) => {
  const college = await requireCollege(id);
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (code !== undefined) patch.code = code;
  if (status !== undefined) {
    if (!["active", "suspended"].includes(status)) throw new AppError("status must be active or suspended", 400);
    patch.status = status;
  }
  const cleaned = cleanFeatures(features);
  if (cleaned) {
    for (const [key, value] of Object.entries(cleaned)) patch[`features.${key}`] = value;
  }
  await collegeRepository.updateById(college._id, patch);
  forget(college._id);
  return getCollegeDetail(college._id);
};

// ── Superadmin: a college's CS accounts ────────────────────────────────────

const addCsAccount = async (collegeId, data = {}) => {
  const college = await requireCollege(collegeId);
  if (await userService.emailExists(data.email)) {
    throw new AppError("That email already has a Proctavo account", 409);
  }
  await runAsCollege(college, () =>
    userService.createUser({ ...data, designation: "Other", roles: ["cs"], department: data.department || "Exam cell" })
  );
  return getCollegeDetail(college._id);
};

const requireCsOf = async (college, userId) => {
  const user = await runAsCollege(college, () => userService.findAnyById(userId));
  if (!user || !(user.roles || []).includes("cs")) throw new AppError("CS account not found in this college", 404);
  return user;
};

const setCsActive = async (collegeId, userId, active) => {
  const college = await requireCollege(collegeId);
  const user = await requireCsOf(college, userId);
  await runAsCollege(college, () =>
    active ? (user.isActive ? null : userService.activateUser(userId)) : user.isActive ? userService.deleteUser(userId) : null
  );
  return getCollegeDetail(college._id);
};

const resetCsPassword = async (collegeId, userId, password) => {
  const college = await requireCollege(collegeId);
  await requireCsOf(college, userId);
  await runAsCollege(college, () => userService.setPassword(userId, password));
  return { reset: true };
};

module.exports = {
  getCollege,
  toSummary,
  resolveUserCollege,
  forEachActiveCollege,
  runAsUsersCollege,
  listColleges,
  getCollegeDetail,
  createCollege,
  updateCollege,
  addCsAccount,
  setCsActive,
  resetCsPassword,
  SUSPENDED_MESSAGE,
};
