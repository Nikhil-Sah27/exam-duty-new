const ChangeRequest = require("./changeRequest.model");

const POPULATE_FIELDS = [
  { path: "duty", select: "exam room date startTime endTime status" },
  { path: "requestedBy", select: "name email department phone" },
  { path: "swapWith", select: "name email department phone" },
  { path: "reviewedBy", select: "name email" },
];

// Population shared by source + target DCS groups. Mirrors the populate set
// the DCS module uses so the UI gets the same shape for both — schedule,
// assigned rooms (with room + building), departments.
const DCS_GROUP_POPULATE = {
  select:
    "examGroup schedule groupIndex dcsRequired assignedRooms assignedDepartments assignedStudents assignedTeacher status",
  populate: [
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
  ],
};

// Deep populate: duty → exam, plus move-request target refs and DCS group refs.
const POPULATE_DEEP = [
  {
    path: "duty",
    select: "exam room roomRef date startTime endTime status teacher",
    populate: [
      { path: "exam", select: "name department" },
      // roomRef → Room (+ building) so the "Current" card can show the full
      // "Building — Room" label, matching the "Requested" side.
      {
        path: "roomRef",
        select: "roomNumber floor capacity building",
        populate: { path: "building", select: "name" },
      },
    ],
  },
  { path: "requestedBy", select: "name email department phone" },
  { path: "swapWith", select: "name email department phone" },
  { path: "reviewedBy", select: "name email" },
  // Move-request target. The schedule + examRoom let the UI show full slot context.
  {
    path: "requestedSchedule",
    select: "date startTime endTime examGroup",
    populate: { path: "examGroup", select: "examType semester" },
  },
  {
    path: "requestedExamRoom",
    select: "room departments",
    populate: {
      path: "room",
      select: "roomNumber floor capacity building",
      populate: { path: "building", select: "name" },
    },
  },
  // DCS scope refs. Both the source group (current assignment) and the target
  // group (requested assignment) need full room + schedule context so the CS
  // review screen and the requester's history can render without further reads.
  { path: "dcsSourceGroup", ...DCS_GROUP_POPULATE },
  { path: "dcsTargetGroup", ...DCS_GROUP_POPULATE },
  // RS scope refs. Client-derived groups → we snapshot the actual duties
  // (source side) and examRooms (target side); populate both so the UI can
  // render the source and target as complete group cards.
  {
    path: "rsSourceDuties",
    select: "room date startTime endTime status examSchedule examRoom",
    populate: [
      {
        path: "examSchedule",
        select: "date startTime endTime examGroup",
        populate: { path: "examGroup", select: "examType semester" },
      },
      {
        path: "examRoom",
        select: "room departments",
        populate: {
          path: "room",
          select: "roomNumber floor capacity building",
          populate: { path: "building", select: "name" },
        },
      },
    ],
  },
  {
    path: "rsTargetExamRooms",
    select: "room departments schedule",
    populate: [
      {
        path: "room",
        select: "roomNumber floor capacity building",
        populate: { path: "building", select: "name" },
      },
      {
        path: "schedule",
        select: "date startTime endTime examGroup",
        populate: { path: "examGroup", select: "examType semester" },
      },
    ],
  },
];

const create = (data) => {
  return ChangeRequest.create(data);
};

const findAll = (filter = {}) => {
  return ChangeRequest.find(filter)
    .populate(POPULATE_DEEP)
    .sort({ createdAt: -1 });
};

const findById = (id) => {
  return ChangeRequest.findById(id).populate(POPULATE_DEEP);
};

const findPendingByDutyAndUser = (dutyId, userId) => {
  return ChangeRequest.findOne({
    duty: dutyId,
    requestedBy: userId,
    status: "pending",
    scope: "duty",
  });
};

const findPendingDcsByUserAndSource = (sourceGroupId, userId) => {
  return ChangeRequest.findOne({
    scope: "dcs_group",
    dcsSourceGroup: sourceGroupId,
    requestedBy: userId,
    status: "pending",
  });
};

const findPendingRsByUserAndSourceKey = (rsSourceKey, userId) => {
  return ChangeRequest.findOne({
    scope: "rs_group",
    rsSourceKey,
    requestedBy: userId,
    status: "pending",
  });
};

const updateById = (id, data) => {
  return ChangeRequest.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_DEEP);
};

const deleteById = (id) => {
  return ChangeRequest.findByIdAndDelete(id);
};

// Find pending/approved requests whose duty is in the given list. Used by the
// exam-cleanup cascade to identify open requests that must be force-cancelled
// when their underlying duty is being released.
const findOpenByDutyIds = (dutyIds, session) => {
  const query = ChangeRequest.find({
    duty: { $in: dutyIds },
    status: { $in: ["pending", "approved"] },
  });
  return session ? query.session(session) : query;
};

const updateManyByIds = (ids, data, session) => {
  return ChangeRequest.updateMany(
    { _id: { $in: ids } },
    data,
    session ? { session } : {},
  );
};

module.exports = {
  create,
  findAll,
  findById,
  findPendingByDutyAndUser,
  findPendingDcsByUserAndSource,
  findPendingRsByUserAndSourceKey,
  updateById,
  deleteById,
  findOpenByDutyIds,
  updateManyByIds,
};
