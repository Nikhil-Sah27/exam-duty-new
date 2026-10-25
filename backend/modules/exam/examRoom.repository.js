const ExamRoom = require("./examRoom.model");
const { ownershipFilter } = require("./sharedSchedule.utils");

const POPULATE_FIELDS = [
  {
    path: "room",
    select: "roomNumber floor capacity building",
    populate: { path: "building", select: "name" },
  },
];

const create = (data) => {
  return ExamRoom.create(data);
};

const findBySchedule = (scheduleId) => {
  return ExamRoom.find({ schedule: scheduleId }).populate(POPULATE_FIELDS);
};

const findBySchedules = (scheduleIds) => {
  return ExamRoom.find({ schedule: { $in: scheduleIds } }).populate(POPULATE_FIELDS);
};

// One exam group's rooms out of the schedules it sits in (a shared slot holds
// other departments' rooms too).
const findForGroup = (examGroupId, schedules) => {
  if (schedules.length === 0) return Promise.resolve([]);
  return ExamRoom.find(ownershipFilter(examGroupId, schedules)).populate(POPULATE_FIELDS);
};

const findById = (id) => {
  return ExamRoom.findById(id).populate(POPULATE_FIELDS);
};

const findManyByIds = (ids) => {
  return ExamRoom.find({ _id: { $in: ids } }).populate(POPULATE_FIELDS);
};

const deleteById = (id) => {
  return ExamRoom.findByIdAndDelete(id);
};

const deleteBySchedule = (scheduleId) => {
  return ExamRoom.deleteMany({ schedule: scheduleId });
};

const deleteBySchedules = (scheduleIds) => {
  return ExamRoom.deleteMany({ schedule: { $in: scheduleIds } });
};

module.exports = {
  create,
  findBySchedule,
  findBySchedules,
  findForGroup,
  findById,
  findManyByIds,
  deleteById,
  deleteBySchedule,
  deleteBySchedules,
};
