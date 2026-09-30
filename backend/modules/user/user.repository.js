const User = require("./user.model");

const ALLOWED_FIELDS = "name email phone roles department designation isActive createdAt updatedAt";

const create = (data) => {
  return User.create(data);
};

const findAll = (filter = {}) => {
  return User.find(filter).select(ALLOWED_FIELDS).sort({ name: 1 });
};

const findById = (id) => {
  return User.findById(id).select(ALLOWED_FIELDS);
};

const updateById = (id, data) => {
  return User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).select(ALLOWED_FIELDS);
};

const softDeleteById = (id) => {
  return User.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  ).select(ALLOWED_FIELDS);
};

// Read a user by id regardless of active state. Passing `isActive` explicitly
// disables the pre-find hook's auto active-only scoping, so soft-deleted users
// are visible (needed to decide soft- vs hard-delete).
const findByIdIncludingInactive = (id) =>
  User.findOne({ _id: id, isActive: { $in: [true, false] } }).select(ALLOWED_FIELDS);

// Permanently remove a user document. `deleteOne` is not a `find` op, so the
// active-only pre-find hook doesn't apply — soft-deleted users are removable.
const hardDeleteById = (id) => User.deleteOne({ _id: id });

// Explicitly filters on isActive so the model's pre-find hook (which auto-scopes
// queries to active users) does not hide the inactive record we want to update.
const activateById = (id) => {
  return User.findOneAndUpdate(
    { _id: id, isActive: false },
    { isActive: true },
    { new: true }
  ).select(ALLOWED_FIELDS);
};

// Matches any user whose `roles` array contains the given role.
const countByRole = (role) => {
  return User.countDocuments({ roles: role });
};

// Returns ObjectIds of active users. Optional role filter matches any user
// whose `roles` array contains at least one of the given roles.
/** { userId: lastActiveAt|null } */
const findLastActive = async (ids) => {
  const docs = await User.find({ _id: { $in: ids } }).select("lastActiveAt");
  return Object.fromEntries(docs.map((d) => [String(d._id), d.lastActiveAt || null]));
};

const findActiveIds = async (roles) => {
  const filter = {};
  if (Array.isArray(roles) && roles.length > 0) {
    filter.roles = { $in: roles };
  }
  const docs = await User.find(filter).select("_id");
  return docs.map((d) => d._id);
};

module.exports = {
  create,
  findAll,
  findById,
  updateById,
  softDeleteById,
  findByIdIncludingInactive,
  hardDeleteById,
  activateById,
  countByRole,
  findActiveIds,
  findLastActive,
};
