const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const dutyRepository = require("./duty.repository");
const Exam = require("../exam/exam.model");
const User = require("../auth/auth.model");
const examScheduleRepo = require("../exam/examSchedule.repository");
const examRoomRepo = require("../exam/examRoom.repository");
const examGroupRepo = require("../exam/examGroup.repository");
const { emit, emitToMany } = require("../notification/notification.emitter");
const userService = require("../user/user.service");
const { buildRoomLabel } = require("../exam-cleanup/utils/examCleanupUtils");
const {
  assertTargetNotReached,
} = require("../duty-calculation/dutyCalculation.service");
const { unitFilter } = require("./duty.unit");
const confirmToken = require("./duty.confirmToken");
const { localToUtc } = require("../../shared/utils/datetime");

/**
 * Tell CS that a teacher took or gave back work themselves. Fire-and-forget and
 * deliberately non-blocking: CS awareness must never be able to fail a
 * teacher's claim or release.
 */
const notifyCsOfTeacherAction = async (type, { refId, data }) => {
  try {
    const recipients = await userService.getCsUserIds();
    if (recipients.length === 0) return;
    await emitToMany(type, {
      recipients,
      refModel: "Duty",
      refId: refId || null,
      data,
    });
  } catch (err) {
    console.error(`[duty] failed to notify CS (${type}):`, err.message);
  }
};

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
  // Names the conflict for the common case. Two clicks landing together can
  // both pass it — the Duty one-live-duty-per-slot index settles those (409).
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

  const roomLabel = buildRoomLabel(populated);

  if (!isSelfAssigned) {
    emit("duty_assigned", {
      recipient: teacherId,
      role: dutyRole,
      refModel: "Duty",
      refId: duty._id,
      data: { room: roomLabel, date, startTime, endTime },
    });
  } else {
    // Self-claim used to notify nobody. The teacher now gets a confirmation
    // (and an email) recording what they committed to, and CS learns the room
    // was taken without having to re-open Manage Duties.
    emit("duty_self_claimed", {
      recipient: teacherId,
      role: dutyRole,
      refModel: "Duty",
      refId: duty._id,
      data: { room: roomLabel, date, startTime, endTime },
    });
    notifyCsOfTeacherAction("duty_claimed_by_teacher", {
      refId: duty._id,
      data: {
        teacherName: populated?.teacher?.name || "A teacher",
        roleLabel: ROLE_LABELS[dutyRole] || dutyRole,
        room: roomLabel,
        date,
      },
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
 * teacher- or room-overlap). Concurrent claims on the same rooms are settled
 * by the Duty one-live-duty-per-slot index: exactly one RS gets the group,
 * the rest get a 409, and nobody is left holding part of it.
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
  // De-dupe defensively; the same examRoom id twice would be a UI bug, and
  // would otherwise trip the one-live-duty-per-slot index as a confusing
  // "already taken" against the caller's own claim.
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

  // The pre-flight above can be raced by a concurrent claim; the duty's
  // one-live-duty-per-slot index can't. A lost race fails here with a 409 and
  // the whole group is undone — never a partial group.
  const createdIds = await withOptionalTransaction(async (session) => {
    const duties = await dutyRepository.createMany(
      resolved.map(({ schedule: s, examRoom }) => ({
        exam: null,
        examSchedule: s._id,
        examRoom: examRoom._id,
        teacher: userId,
        role: activeRole,
        room: examRoom?.room?.roomNumber || "",
        roomRef: examRoom?.room?._id || null,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        assignedBy: userId,
        isSelfAssigned: true,
      })),
      session,
    );
    return duties.map((d) => d._id);
  });

  const populated = await Promise.all(
    createdIds.map((id) => dutyRepository.findById(id)),
  );

  // ONE notification for the whole group, matching the admin-assign path — a
  // group is claimed and held as a single unit, so five rooms is one alert.
  const examGroup = populated[0]?.examSchedule?.examGroup;
  const roleLabel = activeRole === "dcs" ? "DCS" : "RS";
  emit("duty_self_claimed", {
    recipient: userId,
    role: activeRole,
    refModel: "Duty",
    refId: createdIds[0] || null,
    data: {
      roleLabel,
      roomCount: populated.length,
      date,
      startTime,
      endTime,
      examLabel: examGroup?.examType,
      semester: examGroup?.semester,
    },
  });
  notifyCsOfTeacherAction("duty_claimed_by_teacher", {
    refId: createdIds[0] || null,
    data: {
      teacherName: populated[0]?.teacher?.name || "A teacher",
      roleLabel,
      roomCount: populated.length,
      date,
    },
  });

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
    const duties = await dutyRepository.createMany(
      resolved.map(({ schedule: s, examRoom }) => ({
        exam: null,
        examSchedule: s._id,
        examRoom: examRoom._id,
        teacher: teacherId,
        role: dutyRole,
        room: examRoom?.room?.roomNumber || "",
        roomRef: examRoom?.room?._id || null,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        assignedBy: adminId,
        isSelfAssigned: false,
      })),
      session,
    );
    return duties.map((d) => d._id);
  });

  const populated = await Promise.all(
    createdIds.map((id) => dutyRepository.findById(id)),
  );

  // ONE notification for the whole group (RS or DCS) — never per room. The
  // teacher claims/holds the group as a single unit.
  const examGroup = populated[0]?.examSchedule?.examGroup;
  emit("duty_group_assigned", {
    recipient: teacherId,
    role: dutyRole,
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
  // Scope a teacher's duties to one role so a multi-role user's invigilator and
  // RS/DCS duties never leak into each other's dashboards. Omitted by CS views,
  // which want every role.
  if (query.role) filter.role = query.role;
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

/**
 * Cancel a duty. `actor` ({ id, activeRole }) is what separates a CS
 * cancellation from a teacher releasing their own duty: the teacher gets the
 * same confirmation either way, but a self-release additionally tells CS the
 * room just went vacant.
 */
const cancelDuty = async (id, cancelReason, actor = {}) => {
  const duty = await dutyRepository.findById(id);
  if (!duty) throw new AppError("Duty not found", 404);

  const teacherId = duty.teacher?._id || duty.teacher;
  const byCs = actor.activeRole === "cs";
  if (!byCs && String(actor.id) !== String(teacherId)) {
    throw new AppError("You can only cancel your own duty", 403);
  }
  // A DCS group is persisted: cancelling one of its rooms alone would leave the
  // group "claimed" with a stale duty list. CS unassigns the whole group.
  if (byCs && duty.role !== "invigilator") {
    throw new AppError(
      "RS and DCS duties are unassigned as a whole group — use admin-unassign-group",
      400
    );
  }

  if (duty.status === "cancelled") throw new AppError("Duty is already cancelled", 400);
  if (duty.status === "completed") throw new AppError("Cannot cancel a completed duty", 400);

  const updated = await dutyRepository.updateById(id, {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelReason: cancelReason || null,
  });

  const roomLabel = buildRoomLabel(duty);

  emit("duty_cancelled", {
    recipient: duty.teacher,
    role: duty.role,
    refModel: "Duty",
    refId: duty._id,
    data: { room: roomLabel, date: duty.date, reason: byCs ? cancelReason || null : null },
  });

  if (!byCs) {
    notifyCsOfTeacherAction("duty_released_by_teacher", {
      refId: duty._id,
      data: {
        teacherName: duty.teacher?.name || "A teacher",
        room: roomLabel,
        date: duty.date,
        reason: cancelReason || null,
      },
    });
  }

  return updated;
};

/**
 * CS takes a teacher off a whole RS or DCS group. Groups are one duty unit
 * everywhere else, so they are unassigned as one: every room at once, one
 * notification. The caller names any one duty in the group; the group is
 * expanded here so it can never be unassigned partially.
 *
 * A teacher can hold only one duty per time slot (`findTeacherConflict`), so
 * their live RS duties on a schedule ARE their RS group — no re-derivation of
 * the client's chunking is needed. DCS groups are persisted, so they go through
 * `releaseGroup`, which also reopens the `DCSGroup` for claiming.
 */
const adminUnassignDutyGroup = async (dutyId, cancelReason, actor) => {
  if (!dutyId) throw new AppError("dutyId is required", 400);
  const duty = await dutyRepository.findById(dutyId);
  if (!duty) throw new AppError("Duty not found", 404);
  if (duty.role !== "rs" && duty.role !== "dcs") {
    throw new AppError("Group unassign is only valid for RS and DCS duties", 400);
  }
  if (duty.status === "cancelled") throw new AppError("Duty is already cancelled", 400);
  if (duty.status === "completed") throw new AppError("Cannot cancel a completed duty", 400);

  const teacherId = duty.teacher?._id || duty.teacher;
  const duties = await dutyRepository.findAll({
    teacher: teacherId,
    role: duty.role,
    examSchedule: duty.examSchedule?._id || duty.examSchedule,
    status: { $nin: ["cancelled", "completed"] },
  });

  if (duty.role === "dcs") {
    // Lazy require keeps the dcs module out of this file's load order.
    const dcsGroupRepository = require("../dcs/dcsGroup.repository");
    const dcsGroupService = require("../dcs/dcsGroup.service");
    const group = await dcsGroupRepository.findByDuty(duty._id);
    if (!group) throw new AppError("DCS group not found for this duty", 404);
    await dcsGroupService.releaseGroup(group._id, actor, cancelReason);
    return { role: "dcs", count: duties.length, duties };
  }

  await withOptionalTransaction((session) =>
    dutyRepository.cancelMany(duties.map((d) => d._id), cancelReason, session)
  );

  emit("duty_group_cancelled", {
    recipient: teacherId,
    role: "rs",
    refModel: "Duty",
    refId: duty._id,
    data: {
      roleLabel: "RS",
      roomCount: duties.length,
      date: duty.date,
      startTime: duty.startTime,
      endTime: duty.endTime,
      reason: cancelReason || null,
    },
  });

  return { role: "rs", count: duties.length, duties };
};

/**
 * Distinct teachers holding a live duty on any of these schedules. Used by the
 * exam module to fan an exam-details change out to exactly the people affected
 * (services call services — the exam module must not touch this repository).
 */
// ---------- Confirmation (REMINDERS_PLAN.md §B) ----------

const unitEndsAt = (d) =>
  localToUtc(d.examSchedule?.date || d.date, d.examSchedule?.endTime || d.endTime);

/**
 * Confirm a duty unit — every room of an RS/DCS group at once. `teacherId`, when
 * given, must own the duty (the app and the email token both pass it).
 * Returns { confirmed, alreadyConfirmed, duty }.
 */
const confirmDutyUnit = async (dutyId, { teacherId, via }) => {
  const duty = await dutyRepository.findById(dutyId);
  if (!duty) throw new AppError("Duty not found", 404);
  const ownerId = String(duty.teacher?._id || duty.teacher);
  if (teacherId && String(teacherId) !== ownerId) {
    throw new AppError("You can only confirm your own duty", 403);
  }
  if (duty.status !== "assigned") {
    throw new AppError(
      duty.status === "cancelled" ? "This duty is no longer assigned to you" : "This duty has already happened",
      400
    );
  }
  if (duty.confirmedAt) return { confirmed: 0, alreadyConfirmed: true, duty };

  const res = await dutyRepository.updateMany(
    { ...unitFilter(duty), status: "assigned", confirmedAt: null },
    { confirmedAt: new Date(), confirmedVia: via }
  );
  return { confirmed: res.modifiedCount || 0, alreadyConfirmed: false, duty };
};

/**
 * One-off, idempotent: duties self-claimed before confirmation existed are
 * confirmed as of when they were claimed. CS-assigned ones stay unconfirmed —
 * the teacher is asked, which is the point of the feature.
 */
const backfillSelfClaimConfirmations = async () => {
  const res = await dutyRepository.updateMany(
    { isSelfAssigned: true, confirmedAt: null },
    [{ $set: { confirmedAt: "$createdAt", confirmedVia: "self" } }]
  );
  return res.modifiedCount || 0;
};

/** Confirm through the emailed one-click link. */
const confirmDutyByToken = async (token) => {
  const claim = confirmToken.verify(token);
  if (!claim) throw new AppError("This confirmation link is invalid or has expired", 400);
  return confirmDutyUnit(claim.dutyId, { teacherId: claim.teacherId, via: "email" });
};

/**
 * Links for a duty email, or null when there's nothing to confirm (already
 * confirmed, no longer assigned, or already over). Called by the mail dispatcher
 * at send time, so a duty confirmed in the app meanwhile gets no stale button.
 */
const confirmLinksForDuty = async (dutyId) => {
  if (!dutyId) return null;
  const duty = await dutyRepository.findById(dutyId).catch(() => null);
  if (!duty || duty.status !== "assigned" || duty.confirmedAt) return null;
  const endsAt = unitEndsAt(duty);
  if (endsAt <= new Date()) return null;
  const expiresAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  const token = confirmToken.sign({ teacherId: duty.teacher?._id || duty.teacher, dutyId: duty._id, expiresAt });
  const base = (process.env.APP_URL || "https://proctavo.com").replace(/\/$/, "");
  return {
    confirmUrl: `${base}/api/duties/confirm/${token}`,
    // Declining goes through the existing change-request flow so CS still decides.
    declineUrl: `${base}/`,
  };
};

/** Duties (assigned or completed) dated on/after `since`, lean — for reports. */
const getDutiesForResponsiveness = (since) => dutyRepository.findForResponsiveness(since);

/** A teacher's live (assigned) duties, populated — the calendar sync's input. */
const getAssignedDutiesForTeacher = (teacherId) =>
  dutyRepository.findAll({ teacher: teacherId, status: "assigned" });

/** Teachers with an assigned duty dated on/after `since`. */
const getTeacherIdsWithDutiesSince = (since) =>
  dutyRepository.distinctTeachersWithDutiesSince(since);

const getTeacherIdsForSchedules = async (scheduleIds) => {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) return [];
  return dutyRepository.distinctTeachersForSchedules(scheduleIds);
};

module.exports = {
  confirmDutyUnit,
  confirmDutyByToken,
  backfillSelfClaimConfirmations,
  getDutiesForResponsiveness,
  confirmLinksForDuty,
  getAssignedDutiesForTeacher,
  getTeacherIdsWithDutiesSince,
  getTeacherIdsForSchedules,
  selfAssignDuty,
  selfAssignDutyGroup,
  adminAssignDuty,
  adminAssignDutyGroup,
  getAllDuties,
  getDutyById,
  getInvigilatorsForRooms,
  cancelDuty,
  adminUnassignDutyGroup,
};
