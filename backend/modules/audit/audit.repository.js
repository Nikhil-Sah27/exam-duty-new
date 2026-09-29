const AuditLog = require("./audit.model");

const create = (data, session) => {
  if (session) return AuditLog.create([data], { session }).then((d) => d[0]);
  return AuditLog.create(data);
};

const findAll = (filter = {}) =>
  AuditLog.find(filter)
    .populate({ path: "performedBy", select: "name email" })
    .sort({ createdAt: -1 });

const findPage = async (filter = {}, { skip = 0, limit = 25 } = {}) => {
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate({ path: "performedBy", select: "name email" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
};

const findById = (id) =>
  AuditLog.findById(id).populate({ path: "performedBy", select: "name email" });

module.exports = { create, findAll, findPage, findById };
