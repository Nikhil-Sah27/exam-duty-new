const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const User = require("../../modules/auth/auth.model");

const ACTIVE_STAMP_MS = 10 * 60 * 1000;

const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Not authorized — no token", 401));
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.activeRole) {
      return next(
        new AppError("Role not selected — call /auth/select-role first", 401)
      );
    }

    const user = await User.findById(decoded.id).select("roles lastActiveAt");
    if (!user) return next(new AppError("Not authorized — user not found", 401));
    const roles = user.roles || [];

    if (!roles.includes(decoded.activeRole)) {
      return next(
        new AppError("Active role no longer assigned to user", 401)
      );
    }

    // Throttled activity stamp — fire-and-forget, never on the request's path.
    const now = Date.now();
    if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > ACTIVE_STAMP_MS) {
      User.updateOne({ _id: user._id }, { lastActiveAt: new Date(now) }).catch(() => {});
    }

    req.user = {
      id: decoded.id,
      activeRole: decoded.activeRole,
      roles,
    };
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new AppError("Not authorized — invalid token", 401));
    }
    next(err);
  }
};

module.exports = protect;
