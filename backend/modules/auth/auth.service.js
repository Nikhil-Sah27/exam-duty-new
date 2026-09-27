const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AppError = require("../../shared/utils/AppError");
const authRepository = require("./auth.repository");
const {
  enforceRolesForDesignation,
} = require("../../shared/utils/roleResolver");

const SALT_ROUNDS = 10;

const generateToken = (userId, activeRole) => {
  return jwt.sign(
    { id: userId, activeRole: activeRole || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const toUserDTO = (user, activeRole = null) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  department: user.department || null,
  designation: user.designation || null,
  roles: user.roles || [],
  activeRole: activeRole || (user.roles && user.roles.length === 1 ? user.roles[0] : null),
});

const register = async ({ name, email, password, phone, designation, roles }) => {
  const existing = await authRepository.findUserByEmail(email);
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const finalRoles = enforceRolesForDesignation(designation, roles);
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await authRepository.createUser({
    name,
    email,
    password: hashedPassword,
    phone,
    designation,
    roles: finalRoles,
  });

  const activeRole = finalRoles.length === 1 ? finalRoles[0] : null;
  return {
    user: toUserDTO(user, activeRole),
    token: activeRole ? generateToken(user._id, activeRole) : null,
    requiresRoleSelection: !activeRole,
  };
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

  const roles = user.roles || [];
  const activeRole = roles.length === 1 ? roles[0] : null;

  return {
    user: toUserDTO(user, activeRole),
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

  return {
    user: toUserDTO(user, requestedRole),
    token: generateToken(user._id, requestedRole),
  };
};

const getUserById = async (id, activeRole = null) => {
  const user = await authRepository.findUserById(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return toUserDTO(user, activeRole);
};

module.exports = {
  register,
  login,
  selectRole,
  getUserById,
  generateToken,
};
