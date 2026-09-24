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
  activateById,
  countByRole,
  findActiveIds,
};
