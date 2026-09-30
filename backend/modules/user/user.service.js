const bcrypt = require("bcrypt");
const AppError = require("../../shared/utils/AppError");
const userRepository = require("./user.repository");
const {
  enforceRolesForDesignation,
} = require("../../shared/utils/roleResolver");

const SALT_ROUNDS = 10;

const createUser = async ({
  name,
  email,
  password,
  phone,
  roles,
  role, // legacy single-value fallback from clients that haven't updated yet
  department,
  designation,
}) => {
  if (!designation) {
    throw new AppError("Designation is required", 400);
  }
  const requestedRoles = Array.isArray(roles)
    ? roles
    : role
    ? [role]
    : undefined;

  const finalRoles = enforceRolesForDesignation(designation, requestedRoles);

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

const updateUser = async (id, data) => {
  // Never allow password updates through this endpoint.
  delete data.password;

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

  const user = await userRepository.updateById(id, data);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const deleteUser = async (id) => {
  const user = await userRepository.findByIdIncludingInactive(id);
  if (!user) throw new AppError("User not found", 404);

  // Deleting an already-deactivated teacher removes them permanently. The first
  // delete of an active teacher only soft-deletes (deactivates) so history and
  // reactivation are preserved; deleting again clears the record for good.
  if (!user.isActive) {
    await userRepository.hardDeleteById(id);
    return user;
  }

  return userRepository.softDeleteById(id);
};

const activateUser = async (id) => {
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
const getCsUserIds = () => userRepository.findActiveIds(["cs"]);

const getLastActiveMap = (ids) => userRepository.findLastActive(ids);

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, activateUser, bootstrapAdmin, getCsUserIds, getLastActiveMap };
