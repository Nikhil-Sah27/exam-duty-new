const College = require("./college.model");

// Pure database operations. College is platform-level (no tenancy plugin), so
// these work in any scope.

const findById = (id) => College.findById(id).lean();

const findAll = () => College.find().sort({ createdAt: 1 }).lean();

const findActive = () => College.find({ status: "active" }).sort({ createdAt: 1 }).lean();

/** The college that legacy (pre-multi-college) data belongs to. */
const findOldest = () => College.findOne().sort({ createdAt: 1, _id: 1 }).lean();

const count = () => College.countDocuments();

const create = (data) => College.create(data);

const updateById = (id, data) =>
  College.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();

const deleteById = (id) => College.deleteOne({ _id: id });

module.exports = { findById, findAll, findActive, findOldest, count, create, updateById, deleteById };
