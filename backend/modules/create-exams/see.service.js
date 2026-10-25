const ExamGroup = require("../exam/examGroup.model");
const ExamSchedule = require("../exam/examSchedule.model");
const ExamRoom = require("../exam/examRoom.model");
const CIEPlanEntry = require("./ciePlan.model");
const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const departmentService = require("../department/department.service");
const { resolveAssignment } = require("./assignmentResolver");
const dcsGroupService = require("../dcs/dcsGroup.service");
const examScheduleService = require("../exam/examSchedule.service");
const dutyService = require("../duty/duty.service");
const roomReservationService = require("../exam/roomReservation.service");
const seatSharingService = require("../seat-sharing/seatSharing.service");
const { notifyExamPublished } = require("./examNotification.service");

/**
 * Same time-overlap math used elsewhere in the codebase.
 */
const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

// SEE schedule rows accept either a bare `courseId` (legacy) or a `courseToken`
// (new — accepts "course:<id>" or "group:<electiveGroupId>"). Normalise once so
// downstream code has a single field to work with.
const tokenForRow = (s) => s.courseToken || (s.courseId ? `course:${s.courseId}` : null);

const validateSchedules = (schedules) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError("At least one course must be scheduled", 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const s of schedules) {
    const token = tokenForRow(s);
    if (!token) throw new AppError("Every scheduled row must include courseId or courseToken", 400);
    if (!s.date) throw new AppError("Every scheduled row must include date", 400);
    if (!s.startTime || !s.endTime) {
      throw new AppError("Every scheduled row must include startTime and endTime", 400);
    }
    if (toMinutes(s.startTime) >= toMinutes(s.endTime)) {
      throw new AppError(`End time must be after start time for ${token}`, 400);
    }
    const day = new Date(s.date);
    day.setHours(0, 0, 0, 0);
    if (day < today) {
      throw new AppError("Cannot schedule a SEE exam in the past", 400);
    }
  }

  // Duplicate detection is by token: the same course OR the same elective
  // group cannot be scheduled twice.
  const seenTokens = new Set();
  for (const s of schedules) {
    const token = tokenForRow(s);
    if (seenTokens.has(token)) {
      throw new AppError("The same course or elective group cannot be scheduled twice", 409);
    }
    seenTokens.add(token);
  }

  // Internal overlap: two schedules in this batch on the same date with
  // overlapping windows for the same department conflict.
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i];
      const b = schedules[j];
      if (!sameDay(a.date, b.date)) continue;
      if (overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) {
        throw new AppError(
          `Schedules overlap on ${new Date(a.date).toDateString()}: ` +
            `${a.startTime}–${a.endTime} and ${b.startTime}–${b.endTime}`,
          409
        );
      }
    }
  }
};

/**
 * Create a complete SEE plan: ExamGroup (examType=SEE) + one ExamSchedule
 * per course + a CIEPlanEntry linking each schedule to (department, course).
 * Returns a courseId → scheduleId mapping the frontend uses to bridge into
 * the room-assignment phase.
 */
const createSEEPlan = async (data, userId) => {
  const { departmentId, semester, schedules } = data;

  if (!departmentId) throw new AppError("Department is required", 400);
  if (!semester) throw new AppError("Semester is required", 400);

  validateSchedules(schedules);

  const department = await departmentService.findDepartmentById(departmentId);
  if (!department) throw new AppError("Department not found", 404);

  // Resolve the semester record — the schedule-creation step needs nothing
  // from it, but validating it exists for this department catches typos.
  const semesterRecord = await departmentService.findSemesterByNumber(
    departmentId,
    semester,
  );
  if (!semesterRecord) {
    throw new AppError(`Semester ${semester} not found for this department`, 404);
  }

  // Resolve every row to its concrete course IDs (fan-out for group tokens),
  // then verify all resolved courses belong to that semester.
  const resolvedByRow = [];
  const allCourseIds = new Set();
  for (const s of schedules) {
    const token = tokenForRow(s);
    const resolved = await resolveAssignment(token);
    resolvedByRow.push(resolved);
    for (const cid of resolved.courseIds) allCourseIds.add(String(cid));
  }
  const uniqueCourseIds = [...allCourseIds];
  const courses = await departmentService.findCoursesInSemester(
    uniqueCourseIds,
    semesterRecord._id,
  );
  if (courses.length !== uniqueCourseIds.length) {
    throw new AppError(
      "One or more courses do not belong to the selected department/semester",
      400,
    );
  }

  // Derive the group's date range from the schedules.
  const dates = schedules.map((s) => new Date(s.date)).sort((a, b) => a - b);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Duplicate detection against existing SEE groups with overlapping dates.
  const duplicate = await ExamGroup.findOne({
    examType: "SEE",
    semester: parseInt(semester, 10),
    isActive: true,
    $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
  });
  if (duplicate) {
    throw new AppError(
      `A SEE exam for Semester ${semester} already exists with overlapping dates`,
      409,
    );
  }

  const examGroup = await ExamGroup.create({
    examType: "SEE",
    semester: parseInt(semester, 10),
    startDate,
    endDate,
    createdBy: userId,
  });

  const scheduleMapping = {};

  for (let i = 0; i < schedules.length; i++) {
    const entry = schedules[i];
    const token = tokenForRow(entry);
    const schedule = await ExamSchedule.create({
      examGroup: examGroup._id,
      date: new Date(entry.date),
      startTime: entry.startTime,
      endTime: entry.endTime,
    });

    // Fan-out: one CIEPlanEntry per member course of the token.
    for (const cid of resolvedByRow[i].courseIds) {
      await CIEPlanEntry.create({
        examGroup: examGroup._id,
        schedule: schedule._id,
        department: departmentId,
        course: cid,
      });
    }

    scheduleMapping[token] = schedule._id;
  }

  return { ...examGroup.toObject(), scheduleMapping };
};

// ---------------------------------------------------------------------------
// Finalize (single-call transactional creation for SEE — multi-department)
//
// The frontend ships one plan PER selected department (schedules + room
// assignments + seat-sharing), all under one semester. We persist a SEPARATE
// ExamGroup per department (examType=SEE, department=<id>) so each
// (department, semester) renders as its own completely independent exam card —
// CSE's courses/rooms are never mixed with ME's. Everything is created inside a
// single transaction: if any department fails, nothing is persisted.
//
// Payload:
//   { semester, departments: [ { departmentId, schedules, roomAssignments,
//     shareableRoomMarks?, globalSharedConsumptions? } ] }
//
// Each schedule's `localId`/`slotKey` is globally unique across departments, so
// room assignments reference it unambiguously.
// ---------------------------------------------------------------------------

/**
 * Validate + resolve a single department's plan ahead of the transaction.
 * Returns everything the write step needs, or throws a 4xx AppError.
 */
const prepareDepartmentPlan = async (dep, semester) => {
  const {
    departmentId,
    schedules,
    roomAssignments = [],
    shareableRoomMarks = [],
    globalSharedConsumptions = [],
  } = dep || {};

  if (!departmentId) {
    throw new AppError("Each department plan requires a departmentId", 400);
  }
  validateSchedules(schedules);

  if (!Array.isArray(roomAssignments) || roomAssignments.length === 0) {
    throw new AppError(
      "Room assignments are required before creating an exam",
      400,
    );
  }

  // Every schedule's slotKey must have at least one room assigned.
  const scheduleSlotKeys = new Set(schedules.map((s) => s.slotKey || s.localId));
  const assignmentSlotKeys = new Set(roomAssignments.map((a) => a.scheduleId));
  for (const key of scheduleSlotKeys) {
    if (!key) {
      throw new AppError("Every scheduled row must include a slotKey/localId", 400);
    }
    if (!assignmentSlotKeys.has(key)) {
      throw new AppError(
        "Cannot create exam until all schedules have rooms assigned.",
        400,
      );
    }
  }

  const department = await departmentService.findDepartmentById(departmentId);
  if (!department) throw new AppError("Department not found", 404);

  const semesterRecord = await departmentService.findSemesterByNumber(
    departmentId,
    semester,
  );
  if (!semesterRecord) {
    throw new AppError(`Semester ${semester} not found for ${department.code}`, 404);
  }

  // Cross-semester leakage guard — resolve each row (bare courseId, course:
  // token, or group: token) to its member course IDs before checking.
  const resolvedByRow = [];
  const allCourseIds = new Set();
  for (const s of schedules) {
    const token = tokenForRow(s);
    const resolved = await resolveAssignment(token);
    resolvedByRow.push(resolved);
    for (const cid of resolved.courseIds) allCourseIds.add(String(cid));
  }
  const uniqueCourseIds = [...allCourseIds];
  const courses = await departmentService.findCoursesInSemester(
    uniqueCourseIds,
    semesterRecord._id,
  );
  if (courses.length !== uniqueCourseIds.length) {
    throw new AppError(
      `One or more courses do not belong to ${department.code} / semester ${semester}`,
      400,
    );
  }

  const dates = schedules.map((s) => new Date(s.date)).sort((a, b) => a - b);

  return {
    departmentId,
    department,
    schedules,
    roomAssignments,
    shareableRoomMarks,
    globalSharedConsumptions,
    resolvedByRow,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
};

/**
 * Persist one department's SEE plan inside the shared transaction. Returns a
 * summary object (the created ExamGroup plus counts).
 */
const persistDepartmentPlan = async (prep, { semInt, userId, session }) => {
  const sessionOpt = session ? { session } : {};
  const {
    departmentId,
    schedules,
    roomAssignments,
    shareableRoomMarks,
    globalSharedConsumptions,
    resolvedByRow,
    startDate,
    endDate,
  } = prep;

  const [examGroup] = await ExamGroup.create(
    [
      {
        examType: "SEE",
        semester: semInt,
        department: departmentId,
        startDate,
        endDate,
        createdBy: userId,
      },
    ],
    sessionOpt,
  );

  const slotKeyToScheduleId = new Map();
  for (let i = 0; i < schedules.length; i++) {
    const entry = schedules[i];
    const slotKey = entry.slotKey || entry.localId;
    // Same semester, same date + exact time → join that department's slot.
    const shared = await examScheduleService.findSharedSeeSitting(entry, semInt, session);
    let schedule = shared;
    if (shared) {
      await examScheduleService.joinSharedSitting(shared._id, examGroup._id, session);
    } else {
      [schedule] = await ExamSchedule.create(
        [
          {
            examGroup: examGroup._id,
            date: new Date(entry.date),
            startTime: entry.startTime,
            endTime: entry.endTime,
          },
        ],
        sessionOpt,
      );
    }
    slotKeyToScheduleId.set(slotKey, schedule._id);

    // Fan-out: one CIEPlanEntry per member course of the row's token.
    for (const cid of resolvedByRow[i].courseIds) {
      await CIEPlanEntry.create(
        [
          {
            examGroup: examGroup._id,
            schedule: schedule._id,
            department: departmentId,
            course: cid,
          },
        ],
        sessionOpt,
      );
    }
  }

  // Group room assignments by (schedule, room); merge department codes.
  const roomGroups = new Map();
  for (const a of roomAssignments) {
    const scheduleId = slotKeyToScheduleId.get(a.scheduleId);
    if (!scheduleId) {
      throw new AppError(
        `Room assignment references unknown slot ${a.scheduleId}`,
        400,
      );
    }
    const key = `${scheduleId}|${a.roomId}`;
    if (!roomGroups.has(key)) {
      roomGroups.set(key, {
        schedule: scheduleId,
        room: a.roomId,
        departments: new Set(),
      });
    }
    roomGroups.get(key).departments.add(a.departmentCode);
  }

  const examRoomIdByScheduleRoom = new Map();
  for (const [key, group] of roomGroups.entries()) {
    const [created] = await ExamRoom.create(
      [
        {
          schedule: group.schedule,
          room: group.room,
          // Tells this department's rooms apart on a shared slot.
          examGroup: examGroup._id,
          departments: Array.from(group.departments),
        },
      ],
      sessionOpt,
    );
    examRoomIdByScheduleRoom.set(key, created._id);
  }

  // ---- Seat sharing (owner side) ----
  let shareableConfigsCreated = 0;
  for (const mark of shareableRoomMarks) {
    const scheduleId = slotKeyToScheduleId.get(mark.scheduleKey);
    if (!scheduleId) {
      throw new AppError(
        `Shareable mark references unknown slot ${mark.scheduleKey}`,
        400,
      );
    }
    const examRoomId = examRoomIdByScheduleRoom.get(`${scheduleId}|${mark.roomId}`);
    if (!examRoomId) {
      throw new AppError(
        "Shareable mark references a room that isn't in this exam's assignments",
        400,
      );
    }
    await seatSharingService.markRoomShareable({
      examRoomId,
      initialShareableSeats: mark.initialShareableSeats,
      userId,
      session,
    });
    shareableConfigsCreated += 1;
  }

  // ---- Seat sharing (consumer side) ----
  // Consumers borrow from rooms owned by OTHER (already-persisted) exam groups,
  // referenced by their real examRoom id — safe across the per-department split.
  let sharedAllocationsCreated = 0;
  for (const consumption of globalSharedConsumptions) {
    const consumerScheduleId = slotKeyToScheduleId.get(consumption.scheduleKey);
    if (!consumerScheduleId) {
      throw new AppError(
        `Shared consumption references unknown slot ${consumption.scheduleKey}`,
        400,
      );
    }
    await seatSharingService.allocateSharedSeats({
      examRoomId: consumption.sourceExamRoomId,
      consumerExamGroupId: examGroup._id,
      consumerScheduleId,
      consumerDepartmentCode: consumption.departmentCode,
      studentsAllocated: consumption.studentsAllocated,
      session,
    });
    sharedAllocationsCreated += 1;
  }

  return {
    group: examGroup,
    scheduleIds: [...new Set(slotKeyToScheduleId.values())],
    summary: {
      ...examGroup.toObject(),
      departmentCode: prep.department.code,
      schedulesCreated: slotKeyToScheduleId.size,
      roomsCreated: roomGroups.size,
      shareableConfigsCreated,
      sharedAllocationsCreated,
    },
  };
};

const finalizeSEEPlan = async (data, userId) => {
  const { semester, departments } = data;

  if (!semester) throw new AppError("Semester is required", 400);
  if (!Array.isArray(departments) || departments.length === 0) {
    throw new AppError("At least one department must be provided", 400);
  }

  const semInt = parseInt(semester, 10);

  // No duplicate departments in the same batch.
  const deptIds = departments.map((d) => String(d.departmentId));
  if (new Set(deptIds).size !== deptIds.length) {
    throw new AppError("A department can only appear once per batch", 400);
  }

  // ---- Validate + resolve every department plan up front ----
  const prepared = [];
  for (const dep of departments) {
    prepared.push(await prepareDepartmentPlan(dep, semester));
  }

  // ---- Reject re-creating a department's SEE for this semester ----
  for (const p of prepared) {
    const existing = await ExamGroup.findOne({
      examType: "SEE",
      semester: semInt,
      department: p.departmentId,
      isActive: true,
      $or: [{ startDate: { $lte: p.endDate }, endDate: { $gte: p.startDate } }],
    });
    if (existing) {
      throw new AppError(
        `A SEE exam for ${p.department.code} — Semester ${semester} already exists with overlapping dates`,
        409,
      );
    }
  }

  // ---- Global room-reservation check across ALL departments ----
  // Passing every department's requests in one call lets findInternalConflicts
  // catch two departments booking the same physical room in overlapping windows
  // (the cross-department conflict rule), on top of clashes with other exams.
  const reservationRequests = [];
  const seenPairs = new Set();
  for (const p of prepared) {
    const slotBySlotKey = new Map(
      p.schedules.map((s) => [
        s.slotKey || s.localId,
        { date: s.date, startTime: s.startTime, endTime: s.endTime },
      ]),
    );
    for (const a of p.roomAssignments) {
      const slot = slotBySlotKey.get(a.scheduleId);
      if (!slot) continue;
      const dedupe = `${a.scheduleId}|${a.roomId}`;
      if (seenPairs.has(dedupe)) continue;
      seenPairs.add(dedupe);
      reservationRequests.push({
        roomId: a.roomId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }
  await roomReservationService.assertNoConflicts({ requests: reservationRequests });

  // Seat-sharing pre-flight — validate every consumption before writing.
  for (const p of prepared) {
    await seatSharingService.validateConsumptions(p.globalSharedConsumptions);
  }

  const results = await withOptionalTransaction(async (session) => {
    const out = [];
    for (const prep of prepared) {
      out.push(await persistDepartmentPlan(prep, { semInt, userId, session }));
    }
    return out;
  });

  // Post-commit regrouping (reads back ExamRooms), once per touched schedule —
  // a shared slot's DCS and RS groups re-form over every department now
  // sitting in it, and anyone already holding one of them is told which rooms
  // were added. Failure-isolated: the exams themselves already exist.
  const touchedSchedules = new Set(results.flatMap((r) => r.scheduleIds.map(String)));
  for (const scheduleId of touchedSchedules) {
    try {
      await dcsGroupService.syncGroupsForSchedule(scheduleId, { cause: "join" });
    } catch (err) {
      console.error("DCS group sizing failed for schedule", scheduleId, err);
    }
    try {
      await dutyService.syncRsGroupsForSchedule(scheduleId, { cause: "join" });
    } catch (err) {
      console.error("RS regrouping failed for schedule", scheduleId, err);
    }
  }

  // One exam_created announcement for the whole batch, not one per department —
  // otherwise every teacher gets N identical "SEE · Semester X" alerts (and pushes).
  // The date range spans every department's group.
  try {
    await notifyExamPublished({
      examType: "SEE",
      semester: semInt,
      startDate: new Date(Math.min(...prepared.map((p) => p.startDate.getTime()))),
      endDate: new Date(Math.max(...prepared.map((p) => p.endDate.getTime()))),
    });
  } catch (err) {
    console.error("exam_created notification failed for SEE batch", semInt, err);
  }

  return results.map((r) => r.summary);
};

module.exports = { createSEEPlan, finalizeSEEPlan };
