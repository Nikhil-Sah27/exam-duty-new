const ExamGroup = require("../exam/examGroup.model");
const ExamSchedule = require("../exam/examSchedule.model");
const ExamRoom = require("../exam/examRoom.model");
const CIEPlanEntry = require("./ciePlan.model");
const Course = require("../department/course.model");
const Department = require("../department/department.model");
const Semester = require("../department/semester.model");
const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const ElectiveGroup = require("../department/electiveGroup.model");
const { resolveAssignment } = require("./assignmentResolver");
const dcsGroupService = require("../dcs/dcsGroup.service");
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

  const department = await Department.findById(departmentId);
  if (!department) throw new AppError("Department not found", 404);

  // Resolve the semester record — the schedule-creation step needs nothing
  // from it, but validating it exists for this department catches typos.
  const semNumber = String(semester);
  const pattern = "^(Sem(ester)?\\s*)?0?" + semNumber + "$";
  const semesterRecord = await Semester.findOne({
    department: departmentId,
    $or: [
      { name: semNumber },
      { name: { $regex: new RegExp(pattern, "i") } },
    ],
  });
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
  const courses = await Course.find({
    _id: { $in: uniqueCourseIds },
    semester: semesterRecord._id,
  });
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
// Finalize (single-call transactional creation for SEE)
//
// Same contract as cie.service.finalizeCIEPlan: the frontend ships the full
// draft (config + per-course schedules + room assignments) and we persist
// ExamGroup, ExamSchedules, CIEPlanEntries (one dept per slot for SEE), and
// ExamRooms inside one transaction. Frontend uses each schedule's
// `localId` as the synthetic slotKey for room assignments.
// ---------------------------------------------------------------------------

const finalizeSEEPlan = async (data, userId) => {
  const {
    departmentId,
    semester,
    schedules,
    roomAssignments,
    // Global Seat Sharing — same contract as CIE.
    shareableRoomMarks = [],
    globalSharedConsumptions = [],
  } = data;

  if (!departmentId) throw new AppError("Department is required", 400);
  if (!semester) throw new AppError("Semester is required", 400);
  validateSchedules(schedules);

  if (!Array.isArray(roomAssignments) || roomAssignments.length === 0) {
    throw new AppError("Room assignments are required before creating an exam", 400);
  }

  // Every schedule's slotKey must be present in roomAssignments.
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

  const department = await Department.findById(departmentId);
  if (!department) throw new AppError("Department not found", 404);

  const semNumber = String(semester);
  const pattern = "^(Sem(ester)?\\s*)?0?" + semNumber + "$";
  const semesterRecord = await Semester.findOne({
    department: departmentId,
    $or: [
      { name: semNumber },
      { name: { $regex: new RegExp(pattern, "i") } },
    ],
  });
  if (!semesterRecord) {
    throw new AppError(`Semester ${semester} not found for this department`, 404);
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
  const courses = await Course.find({
    _id: { $in: uniqueCourseIds },
    semester: semesterRecord._id,
  });
  if (courses.length !== uniqueCourseIds.length) {
    throw new AppError(
      "One or more courses do not belong to the selected department/semester",
      400,
    );
  }

  const dates = schedules.map((s) => new Date(s.date)).sort((a, b) => a - b);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // When an existing SEE group for this semester overlaps the requested
  // dates, we merge into it — this lets multiple departments finalize their
  // SEE plans independently and still surface as one "SEE · Semester N" card.
  const existingGroup = await ExamGroup.findOne({
    examType: "SEE",
    semester: parseInt(semester, 10),
    isActive: true,
    $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
  });

  // Global room-reservation check — reject if any physical room is already
  // booked in an overlapping window (any exam type, semester, department).
  const slotBySlotKey = new Map();
  for (const s of schedules) {
    const key = s.slotKey || s.localId;
    slotBySlotKey.set(key, {
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    });
  }
  const uniquePairs = new Set();
  const reservationRequests = [];
  for (const a of roomAssignments) {
    const slot = slotBySlotKey.get(a.scheduleId);
    if (!slot) continue;
    const dedupe = `${a.scheduleId}|${a.roomId}`;
    if (uniquePairs.has(dedupe)) continue;
    uniquePairs.add(dedupe);
    reservationRequests.push({
      roomId: a.roomId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  }
  await roomReservationService.assertNoConflicts({
    requests: reservationRequests,
    // When merging, the existing group's reservations are ours — don't self-conflict.
    excludeExamGroupId: existingGroup?._id || null,
  });

  // Seat-sharing pre-flight — validate consumptions before we begin writing.
  await seatSharingService.validateConsumptions(globalSharedConsumptions);

  const plan = await withOptionalTransaction(async (session) => {
    const sessionOpt = session ? { session } : {};

    // Reuse an existing (SEE, semester) group when one overlaps — otherwise
    // create fresh. When reusing, widen its date range if the new plan pushes
    // past either edge.
    let examGroup;
    if (existingGroup) {
      examGroup = existingGroup;
      const newStart = startDate < examGroup.startDate ? startDate : examGroup.startDate;
      const newEnd = endDate > examGroup.endDate ? endDate : examGroup.endDate;
      if (
        newStart.getTime() !== examGroup.startDate.getTime() ||
        newEnd.getTime() !== examGroup.endDate.getTime()
      ) {
        examGroup.startDate = newStart;
        examGroup.endDate = newEnd;
        await examGroup.save(sessionOpt);
      }
    } else {
      [examGroup] = await ExamGroup.create(
        [
          {
            examType: "SEE",
            semester: parseInt(semester, 10),
            startDate,
            endDate,
            createdBy: userId,
          },
        ],
        sessionOpt,
      );
    }

    // Pre-load schedules the merged group already owns so we can reuse rows
    // for identical (date, startTime, endTime) triples.
    const existingScheduleByKey = new Map();
    if (existingGroup) {
      const prior = await ExamSchedule.find(
        { examGroup: examGroup._id },
        null,
        sessionOpt,
      );
      for (const s of prior) {
        const dateKey = new Date(s.date).toISOString().slice(0, 10);
        existingScheduleByKey.set(`${dateKey}|${s.startTime}|${s.endTime}`, s._id);
      }
    }

    const slotKeyToScheduleId = new Map();
    for (let i = 0; i < schedules.length; i++) {
      const entry = schedules[i];
      const slotKey = entry.slotKey || entry.localId;
      const scheduleKey = `${new Date(entry.date).toISOString().slice(0, 10)}|${entry.startTime}|${entry.endTime}`;
      const reused = existingScheduleByKey.get(scheduleKey);
      let scheduleId;
      if (reused) {
        scheduleId = reused;
      } else {
        const [schedule] = await ExamSchedule.create(
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
        scheduleId = schedule._id;
      }
      slotKeyToScheduleId.set(slotKey, scheduleId);

      // Fan-out: one CIEPlanEntry per member course of the row's token.
      for (const cid of resolvedByRow[i].courseIds) {
        await CIEPlanEntry.create(
          [
            {
              examGroup: examGroup._id,
              schedule: scheduleId,
              department: departmentId,
              course: cid,
            },
          ],
          sessionOpt,
        );
      }
    }

    // Group room assignments by (schedule, room); merge departments.
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

    // When merging into an existing group we may find rooms already created
    // for a reused schedule; merge the new department(s) into their
    // `departments` set rather than colliding on the (schedule, room) unique
    // index.
    const examRoomIdByScheduleRoom = new Map();
    const priorExamRoomByKey = new Map();
    if (existingGroup) {
      const reusedScheduleIds = Array.from(existingScheduleByKey.values());
      if (reusedScheduleIds.length > 0) {
        const prior = await ExamRoom.find(
          { schedule: { $in: reusedScheduleIds } },
          null,
          sessionOpt,
        );
        for (const er of prior) {
          priorExamRoomByKey.set(`${er.schedule}|${er.room}`, er);
        }
      }
    }
    for (const [key, group] of roomGroups.entries()) {
      const existingRoom = priorExamRoomByKey.get(key);
      if (existingRoom) {
        const merged = new Set([...existingRoom.departments, ...group.departments]);
        if (merged.size !== existingRoom.departments.length) {
          existingRoom.departments = Array.from(merged);
          await existingRoom.save(sessionOpt);
        }
        examRoomIdByScheduleRoom.set(key, existingRoom._id);
        continue;
      }
      const [created] = await ExamRoom.create(
        [
          {
            schedule: group.schedule,
            room: group.room,
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
      const examRoomId = examRoomIdByScheduleRoom.get(
        `${scheduleId}|${mark.roomId}`,
      );
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

    // ---- Intra-batch consumers of shareable rooms ----
    // See cie.service.js for the rationale. Any `isShared` roomAssignment whose
    // source is a marked shareable room must decrement the shared-seats
    // counter so later exam groups see the correct remaining pool.
    for (const a of roomAssignments) {
      if (!a.isShared) continue;
      const scheduleId = slotKeyToScheduleId.get(a.scheduleId);
      if (!scheduleId) continue;
      const sourceExamRoomId = examRoomIdByScheduleRoom.get(
        `${scheduleId}|${a.roomId}`,
      );
      if (!sourceExamRoomId) continue;
      const studentsAllocated = Number(a.students) || 0;
      if (studentsAllocated <= 0) continue;
      const state = await seatSharingService.getSharingStateForExamRoom(
        sourceExamRoomId,
        session,
      );
      if (!state.config || !state.config.shareable) continue;
      await seatSharingService.allocateSharedSeats({
        examRoomId: sourceExamRoomId,
        consumerExamGroupId: examGroup._id,
        consumerScheduleId: scheduleId,
        consumerDepartmentCode: a.departmentCode,
        studentsAllocated,
        session,
      });
      sharedAllocationsCreated += 1;
    }

    return {
      ...examGroup.toObject(),
      schedulesCreated: slotKeyToScheduleId.size,
      roomsCreated: roomGroups.size,
      shareableConfigsCreated,
      sharedAllocationsCreated,
    };
  });

  // DCS sizing runs post-commit so the read-back sees the just-written
  // ExamRooms (see cie.service.js for the same pattern + rationale).
  try {
    await dcsGroupService.generateDCSGroupsForExamGroup(plan._id);
  } catch (err) {
    console.error("DCS group generation failed for", plan._id, err);
  }

  // Announce the new exam to duty-eligible teachers — only for a freshly
  // created group, not when merging departments into an existing exam.
  if (!existingGroup) {
    try {
      await notifyExamPublished(plan);
    } catch (err) {
      console.error("exam_created notification failed for", plan._id, err);
    }
  }

  return plan;
};

module.exports = { createSEEPlan, finalizeSEEPlan };
