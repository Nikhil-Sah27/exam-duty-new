const AppError = require("../utils/AppError");
const authenticateToken = require("../utils/authenticateToken");
const User = require("../../modules/auth/auth.model");
const { runAsCollege, runAsPlatform } = require("../tenancy/context");

const ACTIVE_STAMP_MS = 10 * 60 * 1000;

// The superadmin manages colleges, it doesn't read them (decision Q3): with no
// college of its own it runs unfiltered, so it may only reach its console and
// its own account — never the college endpoints, which would show every college.
const SUPERADMIN_AREAS = ["/api/platform", "/api/auth"];

/**
 * Valid token → `req.user`, and the rest of the request runs in the caller's
 * college scope (MULTI_COLLEGE_PLAN.md §3.2): every college-owned query from
 * here on sees only that college. The college comes from the user record,
 * never from the request. The superadmin, who belongs to no college, gets the
 * platform scope.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Not authorized — no token", 401));
  }

  let auth;
  try {
    auth = await authenticateToken(header.split(" ")[1]);
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new AppError("Not authorized — invalid token", 401));
    }
    return next(err);
  }
  const { decoded, user, roles, college } = auth;

  // Throttled activity stamp — fire-and-forget, never on the request's path.
  const now = Date.now();
  if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > ACTIVE_STAMP_MS) {
    runAsPlatform(() => User.updateOne({ _id: user._id }, { lastActiveAt: new Date(now) })).catch(() => {});
  }

  req.user = {
    id: decoded.id,
    activeRole: decoded.activeRole,
    roles,
    college: college ? String(college._id) : null,
  };
  if (college) return runAsCollege(college, next);
  if (!SUPERADMIN_AREAS.includes(req.baseUrl)) {
    return next(new AppError("The superadmin console can't open a college's data", 403));
  }
  return runAsPlatform(next);
};

module.exports = protect;
