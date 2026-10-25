const ExamSchedule = require("./examSchedule.model");

const create = (data) => {
  return ExamSchedule.create(data);
};

// Every schedule a group sits in — the ones it owns plus shared slots it
// joined (ExamSchedule.sharedWith). Pair with examRoomRepository.findForGroup
// to get only that group's rooms out of a shared slot.
const membershipFilter = (examGroupId) => ({
  $or: [{ examGroup: examGroupId }, { sharedWith: examGroupId }],
});

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

module.exports = {
  create,
  membershipFilter,
  findByExamGroup,
  findById,
  updateById,
  deleteById,
  deleteByExamGroup,
};
