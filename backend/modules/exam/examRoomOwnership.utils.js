// Which ExamRooms belong to one exam group. Pure — shared by the exam
// repositories and the exam-cleanup cascade.
//
// SEE departments of one semester writing at the same date + time share ONE
// ExamSchedule (owner in `examGroup`, the others in `sharedWith`) so RS chunks
// and DCS sizing span all their rooms. Each department card still sees only its
// own rooms: ExamRoom.examGroup on a shared slot, and rooms with no
// `examGroup` belong to the schedule's owner.

/** Mongo filter for `examGroupId`'s rooms across `schedules` it sits in. */
const ownershipFilter = (examGroupId, schedules) => {
  const id = String(examGroupId);
  const owned = schedules.filter((s) => String(s.examGroup) === id).map((s) => s._id);
  return {
    schedule: { $in: schedules.map((s) => s._id) },
    $or: [{ examGroup: examGroupId }, { examGroup: null, schedule: { $in: owned } }],
  };
};

module.exports = { ownershipFilter };
