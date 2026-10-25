const ExamSchedule = require("./examSchedule.model");
const { membershipFilter } = require("./sharedSchedule.utils");

const create = (data) => {
  return ExamSchedule.create(data);
};

const sessionOpt = (session) => (session ? { session } : {});

// Every schedule a group sits in — the ones it owns plus shared slots it
// joined (ExamSchedule.sharedWith). Pair with examRoomRepository.findForGroup
// to get only that group's rooms out of a shared slot.
const findByExamGroup = (examGroupId) => {
  return ExamSchedule.find(membershipFilter(examGroupId)).sort({ date: 1, startTime: 1 });
};

const findById = (id) => {
  return ExamSchedule.findById(id);
};

const updateById = (id, data) => {
  return ExamSchedule.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

const deleteById = (id) => {
  return ExamSchedule.findByIdAndDelete(id);
};

const deleteByExamGroup = (examGroupId) => {
  return ExamSchedule.deleteMany({ examGroup: examGroupId });
};

/** A schedule of any of `groupIds` at exactly this day + start + end. */
const findSittingOfGroups = ({ groupIds, dayStart, dayEnd, startTime, endTime }, session) =>
  ExamSchedule.findOne({
    date: { $gte: dayStart, $lt: dayEnd },
    startTime,
    endTime,
    $or: [{ examGroup: { $in: groupIds } }, { sharedWith: { $in: groupIds } }],
  }).session(session || null);

/** `groupId` joins `scheduleId` as a shared member. */
const addSharedMember = (scheduleId, groupId, session) =>
  ExamSchedule.updateOne({ _id: scheduleId }, { $addToSet: { sharedWith: groupId } }, sessionOpt(session));

/**
 * `groupId` leaves the shared `schedule`: a joiner drops out of `sharedWith`;
 * the owner hands the slot to the next member. Resolves the new owner's id
 * when ownership moved, else null.
 */
const leaveShared = async (schedule, groupId, session) => {
  if (String(schedule.examGroup) !== String(groupId)) {
    await ExamSchedule.updateOne({ _id: schedule._id }, { $pull: { sharedWith: groupId } }, sessionOpt(session));
    return null;
  }
  const [next, ...rest] = schedule.sharedWith;
  await ExamSchedule.updateOne({ _id: schedule._id }, { examGroup: next, sharedWith: rest }, sessionOpt(session));
  return next;
};

module.exports = {
  create,
  findByExamGroup,
  findSittingOfGroups,
  addSharedMember,
  leaveShared,
  findById,
  updateById,
  deleteById,
  deleteByExamGroup,
};
