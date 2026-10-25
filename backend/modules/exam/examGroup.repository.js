const ExamGroup = require("./examGroup.model");
const ExamSchedule = require("./examSchedule.model");
const ExamRoom = require("./examRoom.model");

const create = (data) => {
  return ExamGroup.create(data);
};

const findAll = (filter = {}) => {
  return ExamGroup.find(filter)
    .populate("createdBy", "name email")
    .sort({ startDate: 1 });
};

const findById = (id) => {
  return ExamGroup.findById(id).populate("createdBy", "name email");
};

const updateById = (id, data) => {
  return ExamGroup.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate("createdBy", "name email");
};

const softDelete = (id) => {
  return ExamGroup.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );
};

/**
 * Aggregate stats for each exam group: total schedules, total rooms,
 * distinct department codes involved.
 */
const findAllWithStats = async (filter = {}) => {
  const groups = await findAll(filter);
  const groupIds = groups.map((g) => g._id);

  // Schedule counts per group — owned schedules plus shared slots the group
  // joined (ExamSchedule.sharedWith), so each department card counts its own.
  const scheduleCounts = await ExamSchedule.aggregate([
    { $match: { $or: [{ examGroup: { $in: groupIds } }, { sharedWith: { $in: groupIds } }] } },
    { $project: { member: { $concatArrays: [["$examGroup"], { $ifNull: ["$sharedWith", []] }] } } },
    { $unwind: "$member" },
    { $match: { member: { $in: groupIds } } },
    { $group: { _id: "$member", count: { $sum: 1 } } },
  ]);

  // Rooms are attributed to the group that owns them: ExamRoom.examGroup on a
  // shared slot, else the schedule's owner.
  const roomsWithOwner = [
    {
      $lookup: {
        from: "examschedules",
        localField: "schedule",
        foreignField: "_id",
        as: "sched",
      },
    },
    { $unwind: "$sched" },
    { $addFields: { owner: { $ifNull: ["$examGroup", "$sched.examGroup"] } } },
    { $match: { owner: { $in: groupIds } } },
  ];

  const roomCounts = await ExamRoom.aggregate([
    ...roomsWithOwner,
    { $group: { _id: "$owner", count: { $sum: 1 } } },
  ]);

  // Distinct department codes per group, aggregated across every ExamRoom the
  // group owns. Rendered as chips on the exam card.
  const departmentSets = await ExamRoom.aggregate([
    ...roomsWithOwner,
    { $unwind: "$departments" },
    { $group: { _id: "$owner", departments: { $addToSet: "$departments" } } },
  ]);

  const scheduleMap = new Map(scheduleCounts.map((s) => [s._id.toString(), s.count]));
  const roomMap = new Map(roomCounts.map((r) => [r._id.toString(), r.count]));
  const departmentMap = new Map(
    departmentSets.map((d) => [d._id.toString(), (d.departments || []).filter(Boolean).sort()])
  );

  return groups.map((g) => {
    const obj = g.toObject();
    obj.totalSchedules = scheduleMap.get(g._id.toString()) || 0;
    obj.totalRooms = roomMap.get(g._id.toString()) || 0;
    obj.departments = departmentMap.get(g._id.toString()) || [];
    return obj;
  });
};

/** { collegeId: live exam groups } — superadmin overview, platform scope. */
const countByCollege = async () => {
  const rows = await ExamGroup.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$college", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
};

module.exports = {
  countByCollege,
  create,
  findAll,
  findById,
  updateById,
  softDelete,
  findAllWithStats,
};
