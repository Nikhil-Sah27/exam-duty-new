const jwt = require("jsonwebtoken");
const AppError = require("./AppError");
const User = require("../../modules/auth/auth.model");

/**
 * Resolve a bearer token to its caller: a valid JWT with a selected
 * `activeRole`, for a user who still holds that role. Shared by `protect` and
 * the realtime socket handshake so both enforce the same rules.
 *
 * Throws AppError(401) for a token that is valid but not usable; jwt errors
 * (`JsonWebTokenError`, `TokenExpiredError`) propagate for the caller to map.
 */
const authenticateToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded.activeRole) {
    throw new AppError("Role not selected — call /auth/select-role first", 401);
  }

  const user = await User.findById(decoded.id).select("roles lastActiveAt");
  if (!user) throw new AppError("Not authorized — user not found", 401);
  const roles = user.roles || [];

  if (!roles.includes(decoded.activeRole)) {
    throw new AppError("Active role no longer assigned to user", 401);
  }

  return { decoded, user, roles };
};

module.exports = authenticateToken;
