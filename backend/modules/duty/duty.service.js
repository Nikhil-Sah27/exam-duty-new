const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const dutyRepository = require("./duty.repository");
const Exam = require("../exam/exam.model");
const User = require("../auth/auth.model");
const examScheduleRepo = require("../exam/examSchedule.repository");
const examRoomRepo = require("../exam/examRoom.repository");
const examGroupRepo = require("../exam/examGroup.repository");
const { emit } = require("../notification/notification.emitter");
const { buildRoomLabel } = require("../exam-cleanup/utils/examCleanupUtils");
const {
  assertTargetNotReached,
} = require("../duty-calculation/dutyCalculation.service");

// ---------- Conflict validation ----------

const ROLE_LABELS = {
  dcs: "DCS",
  rs: "RS",
  invigilator: "invigilator",
};

// The `role` param identifies which slot is being filled (dcs / rs / invigilator).
// It is REQUIRED — a room can host all three role slots concurrently, so the
// conflict scan is meaningless without it.
const validateConflicts = async (teacherId, room, date, startTime, endTime, excludeId, roomRef, role) => {
  if (!role) {
    throw new AppError("Internal: role is required for conflict validation", 500);
  }
  const teacherConflict = await dutyRepository.findTeacherConflict(
    teacherId, date, startTime, endTime, excludeId
  );
  if (teacherConflict) {
    throw new AppError(
      `Teacher already has duty at ${teacherConflict.room} from ${teacherConflict.startTime}–${teacherConflict.endTime} on this date`,
      409
    );
  }

  const roomConflict = await dutyRepository.findRoomConflict(
    room, date, startTime, endTime, role, excludeId, roomRef
  );
  if (roomConflict) {
    const conflictingRole = ROLE_LABELS[roomConflict.role] || "another teacher";
    throw new AppError(
      `Room ${room} is already assigned to another ${conflictingRole} from ${roomConflict.startTime}–${roomConflict.endTime} on this date`,
      409
    );
  }
};

// Resolve which role slot a duty is being claimed for.
//   • self-assign: the caller's activeRole is the slot (validated against roles)
//   • admin-assign: the caller supplies `role` in body (validated against the
//     teacher's roles), falling back to the teacher's only role when unambiguous
const resolveRoleForAssignment = async (teacherId, callerActiveRole, requestedRole, isSelfAssigned) => {
  const teacher = await User.findById(teacherId).select("roles");
  if (!teacher) throw new AppError("Teacher not found", 404);
  const teacherRoles = (teacher.roles || []).filter((r) => r !== "cs"); // CS can't hold duty slots

  const desiredRole = isSelfAssigned ? callerActiveRole : (requestedRole || null);
  if (!desiredRole) {
    // Admin assigning without specifying a role — only unambiguous when the
    // teacher has exactly one duty-eligible role.
    if (teacherRoles.length === 1) return teacherRoles[0];
    throw new AppError(
      "Teacher has multiple roles — specify `role` on the assignment",
      400
    );
  }

  if (!teacherRoles.includes(desiredRole)) {
    throw new AppError(
      `Teacher does not have role "${desiredRole}"`,
      400
    );
  }
  return desiredRole;
};

const validateExam = async (examId) => {
  const exam = await Exam.findById(examId);
  if (!exam) throw new AppError("Exam not found", 404);
  if (exam.isCancelled) throw new AppError("Cannot assign duty — exam is cancelled", 400);
  if (exam.status === "completed") throw new AppError("Cannot assign duty — exam is completed", 400);
  return exam;
};

/**
 * Validate a slot identified by (ExamSchedule._id, ExamRoom._id). Returns the
 * resolved schedule + examRoom (room populated). Throws if any link is broken
 * or the slot's lifecycle no longer permits assignment (past schedule, or
 * the parent exam group fully completed).
 */
const validateScheduleSlot = async (scheduleId, examRoomId) => {
  if (!scheduleId) throw new AppError("examSchedule is required", 400);
  if (!examRoomId) throw new AppError("examRoom is required", 400);

  const [schedule, examRoom] = await Promise.all([
    examScheduleRepo.findById(scheduleId),
    examRoomRepo.findById(examRoomId),
  ]);

  if (!schedule) throw new AppError("Exam schedule not found", 404);
  if (!examRoom) throw new AppError("Exam room assignment not found", 404);
  if (examRoom.schedule.toString() !== scheduleId.toString()) {
    throw new AppError("Exam room does not belong to the given schedule", 400);
  }

  // Per-schedule cutoff. Mirrors the frontend lifecycle filter so a forged
  // request for a past schedule can't slip through after the UI hides it.
  // Same-day duties stay claimable until their endTime passes.
  const now = new Date();
  const day = new Date(schedule.date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) {
    throw new AppError("Cannot assign duty — schedule has already passed", 400);
  }
  if (day.getTime() === today.getTime()) {
    const [eh, em] = (schedule.endTime || "").split(":").map(Number);
    if (Number.isFinite(eh) && Number.isFinite(em)) {
      const endMin = eh * 60 + em;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= endMin) {
        throw new AppError("Cannot assign duty — schedule has already ended", 400);
      }
    }
  }

  const group = await examGroupRepo.findById(schedule.examGroup);
  if (group) {
    if (new Date(group.endDate) < now) {
      throw new AppError("Cannot assign duty — exam group is already completed", 400);
    }
  }

  return { schedule, examRoom };
};

const validateTeacher = async (teacherId) => {
  const teacher = await User.findById(teacherId);
  if (!teacher) throw new AppError("Teacher not found", 404);
  if (!teacher.isActive) throw new AppError("Cannot assign duty — teacher is deactivated", 400);
  return teacher;
};

const validateTimeRange = (startTime, endTime) => {
  if (startTime >= endTime) {
    throw new AppError("End time must be after start time", 400);
  }
};

// ---------- Service methods ----------

/**
 * Two accepted payload shapes:
 *
 *  Legacy:  { exam, teacher, room, date, startTime, endTime }
 *           — used by older Controller flows that still reference Exam._id.
 *  New:     { examSchedule, examRoom, teacher }
 *           — used by the Invigilator self-assign flow built on the
 *             ExamGroup → ExamSchedule → ExamRoom domain. `room`, `date`,
 *             `startTime`, `endTime` are derived from the resolved schedule
 *             + examRoom and do not need to be sent.
 */
const assignDuty = async (data, assignedById, isSelfAssigned, callerActiveRole) => {
  const { exam: examId, examSchedule, examRoom, teacher: teacherId, role: requestedRole } = data;

  let scheduleRef = null;
  let examRoomRef = null;
  let roomRef = null;
  let room = data.room;
  let date = data.date;
  let startTime = data.startTime;
  let endTime = data.endTime;

  if (examSchedule || examRoom) {
    const resolved = await validateScheduleSlot(examSchedule, examRoom);
    scheduleRef = resolved.schedule._id;
    examRoomRef = resolved.examRoom._id;
    roomRef = resolved.examRoom?.room?._id || null;
    room = resolved.examRoom?.room?.roomNumber || "";
    date = resolved.schedule.date;
    startTime = resolved.schedule.startTime;
    endTime = resolved.schedule.endTime;
  } else if (examId) {
    await validateExam(examId);
  } else {
    throw new AppError(
      "Either {examSchedule, examRoom} or {exam} must be provided",
      400
    );
  }

  validateTimeRange(startTime, endTime);
  await validateTeacher(teacherId);
  const dutyRole = await resolveRoleForAssignment(teacherId, callerActiveRole, requestedRole, isSelfAssigned);
  // CS can't assign past a teacher's computed target for this role. Self-claim
  // is intentionally exempt — the requirement is about CS-driven assignment.
  if (!isSelfAssigned) await assertTargetNotReached(teacherId, dutyRole);
  await validateConflicts(teacherId, room, date, startTime, endTime, undefined, roomRef, dutyRole);

  const duty = await withOptionalTransaction((session) =>
    dutyRepository.create(
      {
        exam: examId || null,
        examSchedule: scheduleRef,
        examRoom: examRoomRef,
        teacher: teacherId,
        role: dutyRole,
        room,
        roomRef,
        date,
        startTime,
        endTime,
        assignedBy: assignedById,
        isSelfAssigned,
      },
      session
    )
  );

  const populated = await dutyRepository.findById(duty._id);

  if (!isSelfAssigned) {
    emit("duty_assigned", {
      recipient: teacherId,
      refModel: "Duty",
      refId: duty._id,
      data: { room: buildRoomLabel(populated), date, startTime, endTime },
    });
  }

  return populated;
};

const selfAssignDuty = async (data, userId, activeRole) => {
  return assignDuty({ ...data, teacher: userId }, userId, true, activeRole);
};

/**
 * Self-assign one **room group** for an RS user. The caller supplies a single
 * `examSchedule` and the list of `examRooms` that form the group (validated
 * to all belong to that schedule). The whole batch is written inside one
 * `withOptionalTransaction` block — either every room in the group becomes
 * the RS's duty, or none do.
 *
 * Conflict semantics: the entire group rejects on the first conflict (any
 * teacher- or room-overlap), and the partial state is rolled back when the
 * deployment supports transactions. On standalone Mongo, partial state is
 * possible — same trade-off as elsewhere in the service.
 */
const selfAssignDutyGroup = async (data, userId, activeRole) => {
  const { examSchedule, examRooms } = data;
  if (!activeRole || activeRole === "cs" || activeRole === "invigilator") {
    throw new AppError("selfAssignGroup is only valid for DCS and RS active roles", 400);
  }

  if (!examSchedule) throw new AppError("examSchedule is required", 400);
  if (!Array.isArray(examRooms) || examRooms.length === 0) {
    throw new AppError("examRooms must be a non-empty array", 400);
  }
  // De-dupe defensively; the same examRoom id twice would be a UI bug, but
  // still better to surface it cleanly than to slip past Mongo's room-unique
  // duty index with a confusing 500.
  const uniqueRoomIds = [...new Set(examRooms.map((id) => String(id)))];
  if (uniqueRoomIds.length !== examRooms.length) {
    throw new AppError("examRooms contains duplicate entries", 400);
  }

  await validateTeacher(userId);

  // Resolve & validate every room belongs to the schedule before writing.
  const resolved = await Promise.all(
    uniqueRoomIds.map((roomId) => validateScheduleSlot(examSchedule, roomId)),
  );

  // Snapshot the schedule's date/time once — every room in a group shares it
  // by construction (the schedule itself owns those fields).
  const { schedule } = resolved[0];
  const date = schedule.date;
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;
  validateTimeRange(startTime, endTime);

  // Pre-flight conflict scan: same teacher cannot already have a duty at
  // this time, and each individual room must be free. We surface the first
  // conflict before opening the transaction so the error message names a
  // specific room rather than "transaction aborted".
  for (const { examRoom } of resolved) {
    const roomNumber = examRoom?.room?.roomNumber || "";
    const roomRef = examRoom?.room?._id || null;
    await validateConflicts(userId, roomNumber, date, startTime, endTime, undefined, roomRef, activeRole);
  }

  const createdIds = await withOptionalTransaction(async (session) => {
    const ids = [];
    for (const { schedule: s, examRoom } of resolved) {
      const roomNumber = examRoom?.room?.roomNumber || "";
      const roomRef = examRoom?.room?._id || null;
      const duty = await dutyRepository.create(
        {
          exam: null,
          examSchedule: s._id,
          examRoom: examRoom._id,
          teacher: userId,
          role: activeRole,
          room: roomNumber,
          roomRef,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          assignedBy: userId,
          isSelfAssigned: true,
        },
        session,
      );
      ids.push(duty._id);
    }
    return ids;
  });

  const populated = await Promise.all(
    createdIds.map((id) => dutyRepository.findById(id)),
  );
  return populated;
};

const adminAssignDuty = async (data, adminId) => {
  if (!data.teacher) throw new AppError("Teacher ID is required for admin assignment", 400);
  return assignDuty(data, adminId, false, null);
};

/**
 * Admin-assign one **room group** to a specific teacher. Same transactional
 * semantics as `selfAssignDutyGroup` but the target is `data.teacher` (not the
 * caller), and the role is taken from `data.role` — or inferred when the
 * teacher has exactly one duty-eligible role. A `duty_assigned` notification
 * fires per room in the group so the teacher's bell shows every new duty.
 */
const adminAssignDutyGroup = async (data, adminId) => {
  const { teacher: teacherId, examSchedule, examRooms, role: requestedRole } = data;

  if (!teacherId) throw new AppError("Teacher ID is required for admin assignment", 400);
  if (!examSchedule) throw new AppError("examSchedule is required", 400);
  if (!Array.isArray(examRooms) || examRooms.length === 0) {
    throw new AppError("examRooms must be a non-empty array", 400);
  }
  const uniqueRoomIds = [...new Set(examRooms.map((id) => String(id)))];
  if (uniqueRoomIds.length !== examRooms.length) {
    throw new AppError("examRooms contains duplicate entries", 400);
  }

  await validateTeacher(teacherId);
  const dutyRole = await resolveRoleForAssignment(teacherId, null, requestedRole, false);
  if (dutyRole !== "rs" && dutyRole !== "dcs") {
    throw new AppError("Group assignment is only valid for DCS and RS roles", 400);
  }
  // Block CS group assignment once the teacher has met their role target.
  await assertTargetNotReached(teacherId, dutyRole);

  const resolved = await Promise.all(
    uniqueRoomIds.map((roomId) => validateScheduleSlot(examSchedule, roomId)),
  );

  const { schedule } = resolved[0];
  const date = schedule.date;
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;
  validateTimeRange(startTime, endTime);

  for (const { examRoom } of resolved) {
    const roomNumber = examRoom?.room?.roomNumber || "";
    const roomRef = examRoom?.room?._id || null;
    await validateConflicts(teacherId, roomNumber, date, startTime, endTime, undefined, roomRef, dutyRole);
  }

  const createdIds = await withOptionalTransaction(async (session) => {
    const ids = [];
    for (const { schedule: s, examRoom } of resolved) {
      const roomNumber = examRoom?.room?.roomNumber || "";
      const roomRef = examRoom?.room?._id || null;
      const duty = await dutyRepository.create(
        {
          exam: null,
          examSchedule: s._id,
          examRoom: examRoom._id,
          teacher: teacherId,
          role: dutyRole,
          room: roomNumber,
          roomRef,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          assignedBy: adminId,
          isSelfAssigned: false,
        },
        session,
      );
      ids.push(duty._id);
    }
    return ids;
  });

  const populated = await Promise.all(
    createdIds.map((id) => dutyRepository.findById(id)),
  );

  // ONE notification for the whole group (RS or DCS) — never per room. The
  // teacher claims/holds the group as a single unit.
  const examGroup = populated[0]?.examSchedule?.examGroup;
  emit("duty_group_assigned", {
    recipient: teacherId,
    refModel: "Duty",
    refId: createdIds[0] || null,
    data: {
      roleLabel: dutyRole === "dcs" ? "DCS" : "RS",
      roomCount: populated.length,
      date,
      startTime,
      endTime,
      examLabel: examGroup?.examType,
      semester: examGroup?.semester,
    },
  });

  return populated;
};

const getAllDuties = async (query) => {
  const filter = {};

  if (query.exam) filter.exam = query.exam;
  if (query.teacher) filter.teacher = query.teacher;
  if (query.room) filter.room = query.room;
  if (query.status) filter.status = query.status;
  if (query.date) filter.date = new Date(query.date);

  if (query.from || query.to) {
    filter.date = filter.date || {};
    if (typeof filter.date === "object" && !(filter.date instanceof Date)) {
      if (query.from) filter.date.$gte = new Date(query.from);
      if (query.to) filter.date.$lte = new Date(query.to);
    }
  }

  return dutyRepository.findAll(filter);
};

/**
 * Given a set of ExamRoom ids, return each room with the invigilators
 * currently assigned to it. Used by the RS and DCS dashboards to surface
 * per-room contact info for the people working under a supervisor.
 *
 * Kept role-agnostic on purpose: RS groups are client-derived so we can't
 * key off a stored group id like DCS does. Any authenticated caller may
 * ask about any room set — the data (name / email / phone / department)
 * is already visible elsewhere in the app.
 */
const getInvigilatorsForRooms = async (examRoomIds) => {
  if (!Array.isArray(examRoomIds) || examRoomIds.length === 0) {
    throw new AppError("examRoomIds must be a non-empty array", 400);
  }
  if (examRoomIds.length > 100) {
    throw new AppError("examRoomIds exceeds the 100-id limit", 400);
  }
  const uniqueIds = [...new Set(examRoomIds.map(String))];

  const [examRooms, duties] = await Promise.all([
    dutyRepository.findExamRoomsWithDetails(uniqueIds),
    dutyRepository.findInvigilatorDutiesForRooms(uniqueIds),
  ]);

  const invigilatorsByRoom = new Map();
  for (const d of duties) {
    if (!d.teacher) continue;
    const key = String(d.examRoom);
    const bucket = invigilatorsByRoom.get(key) || [];
    bucket.push({
      _id: d.teacher._id,
      name: d.teacher.name,
      email: d.teacher.email,
      phone: d.teacher.phone || null,
      department: d.teacher.department || null,
    });
    invigilatorsByRoom.set(key, bucket);
  }

  // Preserve caller-provided order so RS/DCS render in group order.
  const byId = new Map(examRooms.map((er) => [String(er._id), er]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((examRoom) => ({
      examRoomId: examRoom._id,
      room: examRoom.room,
      departments: examRoom.departments,
      invigilators: invigilatorsByRoom.get(String(examRoom._id)) || [],
    }));
};

const getDutyById = async (id) => {
  const duty = await dutyRepository.findById(id);
  if (!duty) throw new AppError("Duty not found", 404);
  return duty;
};

const cancelDuty = async (id, cancelReason) => {
  const duty = await dutyRepository.findById(id);
  if (!duty) throw new AppError("Duty not found", 404);
  if (duty.status === "cancelled") throw new AppError("Duty is already cancelled", 400);
  if (duty.status === "completed") throw new AppError("Cannot cancel a completed duty", 400);

  const updated = await dutyRepository.updateById(id, {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelReason: cancelReason || null,
  });

  emit("duty_cancelled", {
    recipient: duty.teacher,
    refModel: "Duty",
    refId: duty._id,
    data: { room: buildRoomLabel(duty), date: duty.date },
  });

  return updated;
};

module.exports = {
  selfAssignDuty,
  selfAssignDutyGroup,
  adminAssignDuty,
  adminAssignDutyGroup,
  getAllDuties,
  getDutyById,
  getInvigilatorsForRooms,
  cancelDuty,
};
