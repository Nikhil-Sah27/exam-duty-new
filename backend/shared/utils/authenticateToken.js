const jwt = require("jsonwebtoken");
const AppError = require("./AppError");
const User = require("../../modules/auth/auth.model");
const { runAsPlatform } = require("../tenancy/context");

/**
 * Resolve a bearer token to its caller: a valid JWT with a selected
 * `activeRole`, for a user who still holds that role, in a college that is
 * still active. Shared by `protect` and the realtime socket handshake so both
 * enforce the same rules.
 *
 * Returns `college` — the caller's College, or null for the superadmin
 * (platform-level). Callers run the rest of the work in that scope.
 *
 * Throws AppError(401) for a token that is valid but not usable; jwt errors
 * (`JsonWebTokenError`, `TokenExpiredError`) propagate for the caller to map.
 */
const authenticateToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded.activeRole) {
    throw new AppError("Role not selected — call /auth/select-role first", 401);
  }

  // Who the caller is decides their college, so this lookup is platform-wide.
  const user = await runAsPlatform(() => User.findById(decoded.id).select("roles lastActiveAt college"));
  if (!user) throw new AppError("Not authorized — user not found", 401);
  const roles = user.roles || [];

  if (!roles.includes(decoded.activeRole)) {
    throw new AppError("Active role no longer assigned to user", 401);
  }

  // 401 so a suspended college's open sessions sign out.
  const college = await require("../../modules/college/college.service").resolveUserCollege(user, 401);

  return { decoded, user, roles, college };
};

module.exports = authenticateToken;
