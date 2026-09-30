const DCSGroup = require("./dcsGroup.model");

const POPULATE = [
  { path: "examGroup", select: "examType semester startDate endDate" },
  { path: "schedule", select: "date startTime endTime examGroup" },
  {
    path: "assignedRooms",
    select: "room departments schedule",
    populate: {
      path: "room",
      select: "roomNumber floor capacity building",
      populate: { path: "building", select: "name" },
    },
  },
  { path: "assignedTeacher", select: "name email phone department" },
];

const create = (data, session) =>
  DCSGroup.create([data], session ? { session } : {}).then((d) => d[0]);

const insertMany = (docs, session) =>
  DCSGroup.insertMany(docs, session ? { session } : {});

const findAll = (filter = {}) =>
  DCSGroup.find(filter).populate(POPULATE).sort({ "schedule.date": 1, groupIndex: 1 });

const findById = (id) => DCSGroup.findById(id).populate(POPULATE);

const findByTeacher = (teacherId) =>
  DCSGroup.find({ assignedTeacher: teacherId, status: "claimed" }).populate(POPULATE);

const findByDuty = (dutyId) => DCSGroup.findOne({ duties: dutyId }).populate(POPULATE);

const findBySchedule = (scheduleId) =>
  DCSGroup.find({ schedule: scheduleId }).populate(POPULATE);

const findByExamGroup = (examGroupId) =>
  DCSGroup.find({ examGroup: examGroupId }).populate(POPULATE);

const findByExamGroups = (examGroupIds) =>
  DCSGroup.find({ examGroup: { $in: examGroupIds } });

const updateById = (id, data, session) =>
  DCSGroup.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    ...(session ? { session } : {}),
  }).populate(POPULATE);

const deleteBySchedules = (scheduleIds, session) =>
  DCSGroup.deleteMany(
    { schedule: { $in: scheduleIds } },
    session ? { session } : {}
  );

const deleteByExamGroups = (examGroupIds, session) =>
  DCSGroup.deleteMany(
    { examGroup: { $in: examGroupIds } },
    session ? { session } : {}
  );

module.exports = {
  create,
  insertMany,
  findAll,
  findById,
  findByTeacher,
  findByDuty,
  findBySchedule,
  findByExamGroup,
  findByExamGroups,
  updateById,
  deleteBySchedules,
  deleteByExamGroups,
};
