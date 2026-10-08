const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AppError = require("../../shared/utils/AppError");
const authRepository = require("./auth.repository");
const { sendOtpEmail } = require("../../shared/utils/mailer");

const SALT_ROUNDS = 10;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

const generateToken = (userId, activeRole) => {
  return jwt.sign(
    { id: userId, activeRole: activeRole || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// Lazy: college.service → user.service → … would otherwise load in a cycle.
const collegeService = () => require("../college/college.service");

const toUserDTO = (user, activeRole = null, college = null) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  department: user.department || null,
  designation: user.designation || null,
  roles: user.roles || [],
  activeRole: activeRole || (user.roles && user.roles.length === 1 ? user.roles[0] : null),
  // The college this account works in, with its feature switches; null for the superadmin.
  college: collegeService().toSummary(college),
});

/**
 * Public self-sign-up — permanently closed. Accounts are created inside a
 * college by its exam cell (Teachers page, CSV import), and a signed-out
 * visitor has no college to join. Left open it was an unauthenticated way to
 * any role ("Other" + "cs" minted an admin).
 */
const register = async () => {
  throw new AppError("Sign-up is closed — ask your college's exam cell to add you to Proctavo.", 403);
};

const login = async ({ email, password }) => {
  const user = await authRepository.findUserByEmail(email);
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }
  // Checked only after the password, so a wrong guess learns nothing about the college.
  const college = await collegeService().resolveUserCollege(user);

  const roles = user.roles || [];
  const activeRole = roles.length === 1 ? roles[0] : null;

  return {
    user: toUserDTO(user, activeRole, college),
    // Single-role user: full token issued immediately.
    // Multi-role user: tempToken lets them call /select-role but is not accepted by protected routes.
    token: activeRole ? generateToken(user._id, activeRole) : null,
    tempToken: activeRole ? null : generateToken(user._id, null),
    requiresRoleSelection: !activeRole,
  };
};

const selectRole = async (userId, requestedRole) => {
  const user = await authRepository.findUserById(userId);
  if (!user) throw new AppError("User not found", 404);

  const roles = user.roles || [];
  if (!roles.includes(requestedRole)) {
    throw new AppError("Role not assigned to this user", 403);
  }
  const college = await collegeService().resolveUserCollege(user);

  return {
    user: toUserDTO(user, requestedRole, college),
    token: generateToken(user._id, requestedRole),
  };
};

/**
 * Start a password reset: generate a 6-digit OTP, store its hash + a 10-minute
 * expiry on the user, and email the code. Intentionally silent about whether the
 * email exists (anti-enumeration) — the controller always returns a generic OK.
 */
const requestPasswordReset = async (email) => {
  if (!email) throw new AppError("Email is required", 400);
  const user = await authRepository.findUserByEmailForReset(
    String(email).toLowerCase().trim(),
  );
  if (!user) return; // don't reveal non-existent accounts

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  user.resetOtpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  user.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.resetOtpAttempts = 0;
  await user.save();

  await sendOtpEmail(user.email, otp, user.name);
};

/**
 * Complete a password reset: verify the OTP (present, unexpired, within the
 * attempt cap, matching) and set the new password, clearing the OTP fields.
 */
const resetPassword = async ({ email, otp, newPassword }) => {
  if (!email || !otp || !newPassword) {
    throw new AppError("Email, code and new password are required", 400);
  }
  if (String(newPassword).length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const user = await authRepository.findUserByEmailForReset(
    String(email).toLowerCase().trim(),
  );
  const invalid = () => new AppError("Invalid or expired code", 400);

  if (!user || !user.resetOtpHash || !user.resetOtpExpires) throw invalid();
  if (user.resetOtpExpires.getTime() < Date.now()) {
    user.resetOtpHash = null;
    user.resetOtpExpires = null;
    user.resetOtpAttempts = 0;
    await user.save();
    throw invalid();
  }
  if ((user.resetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new AppError("Too many attempts — request a new code", 429);
  }

  const matches = await bcrypt.compare(String(otp), user.resetOtpHash);
  if (!matches) {
    user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
    await user.save();
    throw invalid();
  }

  user.password = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
  user.resetOtpHash = null;
  user.resetOtpExpires = null;
  user.resetOtpAttempts = 0;
  await user.save();
};

const getUserById = async (id, activeRole = null) => {
  const user = await authRepository.findUserById(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const college = user.college ? await collegeService().getCollege(user.college) : null;
  return toUserDTO(user, activeRole, college);
};

module.exports = {
  register,
  login,
  selectRole,
  requestPasswordReset,
  resetPassword,
  getUserById,
  generateToken,
};
