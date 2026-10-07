const bcrypt = require("bcrypt");
const AppError = require("../../shared/utils/AppError");
const userRepository = require("./user.repository");
const {
  enforceRolesForDesignation,
  DESIGNATION_ROLE_MAP,
  OTHER_DESIGNATION,
  SELECTABLE_ROLES_FOR_OTHER,
} = require("../../shared/utils/roleResolver");
const departmentService = require("../department/department.service");

const SALT_ROUNDS = 10;

// ── Who may manage which accounts ──────────────────────────────────────────
// Routes already limit account writes to CS. This is the second line for the
// one rule that must never slip if a route is reopened: only CS may create,
// grant, edit or remove a CS account — otherwise a DCS/RS could mint an admin.
const isCsActor = (actor) => !actor || actor.activeRole === "cs"; // no actor = internal/script call

const assertMayTouch = (actor, { targetRoles = [], resultingRoles = [] } = {}) => {
  if (isCsActor(actor)) return;
  if (targetRoles.includes("cs") || resultingRoles.includes("cs")) {
    throw new AppError("Only CS can create or change a CS account", 403);
  }
};

// Profile fields CS may edit. Everything else (password, OTP fields,
// isActive, lastActiveAt…) has its own dedicated path and is never mass-assigned.
const UPDATABLE_FIELDS = ["name", "email", "phone", "department", "designation", "roles", "role"];

const createUser = async ({
  name,
  email,
  password,
  phone,
  roles,
  role, // legacy single-value fallback from clients that haven't updated yet
  department,
  designation,
}, actor) => {
  if (!designation) {
    throw new AppError("Designation is required", 400);
  }
  const requestedRoles = Array.isArray(roles)
    ? roles
    : role
    ? [role]
    : undefined;

  const finalRoles = enforceRolesForDesignation(designation, requestedRoles);
  assertMayTouch(actor, { resultingRoles: finalRoles });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  return userRepository.create({
    name,
    email,
    password: hashedPassword,
    phone,
    roles: finalRoles,
    department,
    designation,
  });
};

const getAllUsers = async (query) => {
  const filter = {};

  if (query.department) filter.department = query.department;
  if (query.role) filter.roles = query.role; // matches any user whose roles array contains `role`
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  } else if (query.includeInactive === "true") {
    // Bypass the auto-active-only pre-find hook so deactivated teachers show in the list.
    filter.isActive = { $in: [true, false] };
  }

  return userRepository.findAll(filter);
};

const getUserById = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const updateUser = async (id, rawData, actor) => {
  // Whitelist: password, OTP and status fields are never writable here.
  const data = Object.fromEntries(
    Object.entries(rawData || {}).filter(([key]) => UPDATABLE_FIELDS.includes(key))
  );

  const target = await userRepository.findByIdIncludingInactive(id);
  if (!target) throw new AppError("User not found", 404);

  // If designation is being changed, re-resolve roles from it.
  if (data.designation !== undefined) {
    const requestedRoles = Array.isArray(data.roles)
      ? data.roles
      : data.role
      ? [data.role]
      : undefined;
    data.roles = enforceRolesForDesignation(data.designation, requestedRoles);
    delete data.role;
  } else {
    // Designation unchanged — do not allow direct role writes.
    delete data.role;
    delete data.roles;
  }
  assertMayTouch(actor, { targetRoles: target.roles || [], resultingRoles: data.roles || [] });

  const user = await userRepository.updateById(id, data);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const deleteUser = async (id, actor) => {
  const user = await userRepository.findByIdIncludingInactive(id);
  if (!user) throw new AppError("User not found", 404);
  assertMayTouch(actor, { targetRoles: user.roles || [] });

  // Deleting an already-deactivated teacher removes them permanently. The first
  // delete of an active teacher only soft-deletes (deactivates) so history and
  // reactivation are preserved; deleting again clears the record for good.
  if (!user.isActive) {
    await userRepository.hardDeleteById(id);
    return user;
  }

  return userRepository.softDeleteById(id);
};

const activateUser = async (id, actor) => {
  const existing = await userRepository.findByIdIncludingInactive(id);
  if (!existing) throw new AppError("User not found", 404);
  assertMayTouch(actor, { targetRoles: existing.roles || [] });
  const user = await userRepository.activateById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const bootstrapAdmin = async () => {
  const count = await userRepository.countByRole("cs");
  if (count > 0) {
    throw new AppError("Bootstrap admin already exists", 409);
  }

  const hashedPassword = await bcrypt.hash("Admin123", SALT_ROUNDS);

  const user = await userRepository.create({
    name: "Admin",
    email: "admin@examduty.com",
    password: hashedPassword,
    designation: "Other",
    roles: ["cs"],
  });

  return userRepository.findById(user._id);
};

/**
 * Ids of every active CS user — the recipient list for "a teacher did
 * something you should know about" alerts. Other domains' services call this
 * rather than querying User themselves (no cross-domain repository access).
 */
// ── CSV import (CS only — enforced by the route) ───────────────────────────
const MAX_IMPORT_ROWS = 1000;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const squash = (v) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Spreadsheet spellings → the designations roleResolver knows.
const DESIGNATION_ALIASES = {
  hoddean: "HOD/Dean", hod: "HOD/Dean", dean: "HOD/Dean", headofdepartment: "HOD/Dean",
  professor: "Professor", prof: "Professor",
  associateprofessor: "Associate Professor", assocprofessor: "Associate Professor",
  assocprof: "Associate Professor", associateprof: "Associate Professor",
  assistantprofessor: "Assistant Professor", asstprofessor: "Assistant Professor",
  asstprof: "Assistant Professor", assistantprof: "Assistant Professor",
  other: OTHER_DESIGNATION,
};
const ROLE_ALIASES = { cs: "cs", dcs: "dcs", rs: "rs", invigilator: "invigilator", invig: "invigilator" };

const resolveDesignation = (value) =>
  DESIGNATION_ALIASES[squash(value)] ||
  Object.keys(DESIGNATION_ROLE_MAP).find((d) => squash(d) === squash(value)) ||
  null;

/**
 * Validate and (unless `dryRun`) create teachers from parsed CSV rows.
 *
 * Every row gets a result — "create" (dry run) / "created", "exists" (email
 * already has an account; skipped, so re-uploading the same file is safe), or
 * "error" with the reason. Valid rows are created even when others fail.
 * Rows without a password use `defaultPassword` (hashed once for the batch).
 */
const importUsers = async (rows, { defaultPassword, dryRun = false } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError("The file has no teacher rows", 400);
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(`Up to ${MAX_IMPORT_ROWS} teachers per file — split it and import in parts`, 400);
  }
  if (defaultPassword && String(defaultPassword).length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`The default password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  }

  const departments = await departmentService.getAllDepartments();
  const findDepartment = (value) => {
    const key = String(value).trim().toLowerCase();
    return departments.find((d) => d.name?.toLowerCase() === key || (d.code && d.code.toLowerCase() === key));
  };

  const results = [];
  const valid = []; // { resultIndex, doc, password }
  const firstRowForEmail = new Map();

  rows.forEach((raw, i) => {
    const line = Number(raw?.line) || i + 2; // spreadsheet row (header is row 1)
    const name = String(raw?.name ?? "").trim();
    const email = String(raw?.email ?? "").trim().toLowerCase();
    const phone = String(raw?.phone ?? "").trim();
    const fail = (message) => results.push({ line, name, email, status: "error", message });

    if (!name) return fail("Name is missing");
    if (!email) return fail("Email is missing");
    if (!EMAIL_RE.test(email)) return fail(`"${email}" isn't a valid email`);
    if (firstRowForEmail.has(email)) return fail(`Same email as row ${firstRowForEmail.get(email)} in this file`);
    firstRowForEmail.set(email, line);
    if ((phone.match(/\d/g) || []).length < 7) return fail(phone ? `"${phone}" doesn't look like a phone number` : "Phone is missing");

    const designation = resolveDesignation(raw?.designation);
    if (!designation) {
      return fail(
        raw?.designation
          ? `Unknown designation "${raw.designation}" — use HOD/Dean, Professor, Associate Professor, Assistant Professor or Other`
          : "Designation is missing"
      );
    }

    let roles;
    if (designation === OTHER_DESIGNATION) {
      const role = ROLE_ALIASES[squash(raw?.role)];
      if (!role || !SELECTABLE_ROLES_FOR_OTHER.includes(role)) {
        return fail('Designation "Other" needs a role: CS, DCS, RS or Invigilator');
      }
      roles = [role];
    } else {
      roles = enforceRolesForDesignation(designation);
    }

    let department = null;
    if (String(raw?.department ?? "").trim()) {
      const match = findDepartment(raw.department);
      if (!match) return fail(`Unknown department "${raw.department}" — add it under Departments first, or fix the spelling`);
      department = match.name;
    }

    const password = String(raw?.password ?? "").trim() || defaultPassword;
    if (!password) return fail("No password — add a password column or set a default password for this import");
    if (String(password).length < MIN_PASSWORD_LENGTH) return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

    results.push({ line, name, email, status: dryRun ? "create" : "pending", roles, designation, department });
    valid.push({ resultIndex: results.length - 1, doc: { name, email, phone, designation, roles, department }, password });
  });

  // Emails that already have an account are skipped, not errors.
  if (valid.length) {
    const existing = await userRepository.findExistingEmails(valid.map((v) => v.doc.email));
    const byEmail = new Map(existing.map((u) => [u.email, u]));
    for (let k = valid.length - 1; k >= 0; k--) {
      const hit = byEmail.get(valid[k].doc.email);
      if (!hit) continue;
      Object.assign(results[valid[k].resultIndex], {
        status: "exists",
        message: hit.isActive ? "Already has an account — skipped" : "Exists but deactivated — reactivate from the Teachers list",
      });
      valid.splice(k, 1);
    }
  }

  if (!dryRun && valid.length) {
    const hashes = new Map(); // one bcrypt per distinct password, not per teacher
    for (const v of valid) {
      if (!hashes.has(v.password)) hashes.set(v.password, await bcrypt.hash(v.password, SALT_ROUNDS));
      v.doc.password = hashes.get(v.password);
    }
    const failed = new Set(await userRepository.createMany(valid.map((v) => v.doc)));
    valid.forEach((v, k) => {
      Object.assign(
        results[v.resultIndex],
        failed.has(k)
          ? { status: "exists", message: "Was added by someone else meanwhile — skipped" }
          : { status: "created" }
      );
    });
  }

  const count = (status) => results.filter((r) => r.status === status).length;
  return {
    dryRun,
    summary: {
      total: rows.length,
      ready: count("create"),
      created: count("created"),
      skipped: count("exists"),
      errors: count("error"),
    },
    results: results.sort((a, b) => a.line - b.line),
  };
};

const getCsUserIds = () => userRepository.findActiveIds(["cs"]);

const getLastActiveMap = (ids) => userRepository.findLastActive(ids);

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, activateUser, bootstrapAdmin, getCsUserIds, getLastActiveMap, importUsers };
