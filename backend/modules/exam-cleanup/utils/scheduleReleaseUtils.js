// Cascade-scope resolvers. Given a deletion entry point (group / schedule /
// room / legacy exam), figure out exactly which schedules, exam-rooms, and
// duties must be touched. Pure reads — no mutations happen here.

const Duty = require("../../duty/duty.model");
const ExamSchedule = require("../../exam/examSchedule.model");
const ExamRoom = require("../../exam/examRoom.model");
const { ownershipFilter } = require("../../exam/examRoomOwnership.utils");
const AppError = require("../../../shared/utils/AppError");

const POPULATE_DUTY = [
  { path: "teacher", select: "name email role" },
  { path: "exam", select: "name semester department" },
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
      select: "roomNumber floor building",
      populate: { path: "building", select: "name" },
    },
  },
];

const findActiveDuties = (filter, session) => {
  const q = Duty.find({ ...filter, status: "assigned" }).populate(POPULATE_DUTY);
  return session ? q.session(session) : q;
};

const withSession = (q, session) => (session ? q.session(session) : q);

// A schedule other exam groups still sit in (ExamSchedule.sharedWith) — when
// one of them leaves, only its own rooms go; the slot stays for the rest.
const isSharedBeyond = (schedule, groupId) => {
  const members = [String(schedule.examGroup), ...(schedule.sharedWith || []).map(String)];
  return members.some((m) => m !== String(groupId));
};

/**
 * Scope for `groupId` leaving `schedules`: schedules only it sits in are
 * deleted outright (`scheduleIds`); from shared ones (`sharedSchedules`) only
 * the rooms it owns are removed.
 */
const scopeForGroupLeaving = async (groupId, schedules, session) => {
  const whole = schedules.filter((s) => !isSharedBeyond(s, groupId));
  const shared = schedules.filter((s) => isSharedBeyond(s, groupId));
  const scheduleIds = whole.map((s) => s._id);

  const roomFilters = [];
  if (scheduleIds.length > 0) roomFilters.push({ schedule: { $in: scheduleIds } });
  if (shared.length > 0) roomFilters.push(ownershipFilter(groupId, shared));
  let examRoomIds = [];
  if (roomFilters.length > 0) {
    const rooms = await withSession(
      ExamRoom.find({ $or: roomFilters }).select("_id"),
      session,
    );
    examRoomIds = rooms.map((r) => r._id);
  }

  // Shared slots keep everyone else's duties: match those by room only.
  const dutyFilter = {
    $or: [
      ...(scheduleIds.length ? [{ examSchedule: { $in: scheduleIds } }] : []),
      ...(examRoomIds.length ? [{ examRoom: { $in: examRoomIds } }] : []),
    ],
  };
  const duties = dutyFilter.$or.length
    ? await findActiveDuties(dutyFilter, session)
    : [];

  return { scheduleIds, sharedSchedules: shared, examRoomIds, duties };
};

const getCascadeScopeForGroup = async (groupId, session) => {
  const schedules = await withSession(
    ExamSchedule.find({ $or: [{ examGroup: groupId }, { sharedWith: groupId }] }),
    session,
  );
  return scopeForGroupLeaving(groupId, schedules, session);
};

const getCascadeScopeForSchedule = async (scheduleId, session) => {
  // A slot several departments share is removed per department, by deleting
  // that department's exam (getCascadeScopeForGroup) — never wholesale here.
  const schedule = await withSession(ExamSchedule.findById(scheduleId), session);
  if (schedule && (schedule.sharedWith || []).length > 0) {
    throw new AppError(
      "This time slot is shared by several departments' exams — delete the department's exam instead",
      409,
    );
  }

  const roomQuery = ExamRoom.find({ schedule: scheduleId }).select("_id");
  const rooms = await (session ? roomQuery.session(session) : roomQuery);
  const examRoomIds = rooms.map((r) => r._id);

  const dutyFilter = {
    $or: [
      { examSchedule: scheduleId },
      ...(examRoomIds.length ? [{ examRoom: { $in: examRoomIds } }] : []),
    ],
  };
  const duties = await findActiveDuties(dutyFilter, session);
  return { scheduleIds: [scheduleId], sharedSchedules: [], examRoomIds, duties };
};

const getCascadeScopeForExamRoom = async (examRoomId, session) => {
  const duties = await findActiveDuties({ examRoom: examRoomId }, session);
  return { scheduleIds: [], examRoomIds: [examRoomId], duties };
};

// Legacy single-Exam path: duties created the old way reference `exam` directly.
// We also catch any newer ExamSchedule whose examGroup happens to map back to
// this exam — but there is no such mapping in the current schema, so we only
// scan the legacy `exam` field.
const getCascadeScopeForExam = async (examId, session) => {
  const duties = await findActiveDuties({ exam: examId }, session);
  return { scheduleIds: [], examRoomIds: [], duties };
};

module.exports = {
  getCascadeScopeForGroup,
  getCascadeScopeForSchedule,
  getCascadeScopeForExamRoom,
  getCascadeScopeForExam,
};
