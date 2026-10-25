// Shared SEE sittings — pure helpers, the single definition of "which
// schedules does an exam group sit in" and "which rooms in them are its own".
// Used by the exam repositories and the exam-cleanup cascade; nothing else
// should spell these filters out.
//
// SEE departments of one semester writing at the same date + time share ONE
// ExamSchedule (owner in `examGroup`, the others in `sharedWith`) so RS chunks
// and DCS sizing span all their rooms. Each department card still sees only its
// own rooms: ExamRoom.examGroup on a shared slot, and rooms with no
// `examGroup` belong to the schedule's owner.

/** Mongo filter: every schedule `examGroupId` owns or joined. */
const membershipFilter = (examGroupId) => ({
  $or: [{ examGroup: examGroupId }, { sharedWith: examGroupId }],
});

/** Mongo filter for `examGroupId`'s rooms across `schedules` it sits in. */
const ownershipFilter = (examGroupId, schedules) => {
  const id = String(examGroupId);
  const owned = schedules.filter((s) => String(s.examGroup) === id).map((s) => s._id);
  return {
    schedule: { $in: schedules.map((s) => s._id) },
    $or: [{ examGroup: examGroupId }, { examGroup: null, schedule: { $in: owned } }],
  };
};

/** True when exam groups other than `groupId` also sit in `schedule`. */
const isSharedBeyond = (schedule, groupId) => {
  const members = [String(schedule.examGroup), ...(schedule.sharedWith || []).map(String)];
  return members.some((m) => m !== String(groupId));
};

module.exports = { membershipFilter, ownershipFilter, isSharedBeyond };
