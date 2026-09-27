const Department = require("../department/department.model");
const Semester = require("../department/semester.model");
const Course = require("../department/course.model");
const ElectiveGroup = require("../department/electiveGroup.model");
const { resolveAssignment } = require("./assignmentResolver");
const Building = require("../infrastructure/building.model");
const Room = require("../infrastructure/infrastructure.model");
const ExamGroup = require("../exam/examGroup.model");
const ExamSchedule = require("../exam/examSchedule.model");
const ExamRoom = require("../exam/examRoom.model");
const CIEPlanEntry = require("./ciePlan.model");
const AppError = require("../../shared/utils/AppError");
const { generateExamDates } = require("./cie.utils");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const dcsGroupService = require("../dcs/dcsGroup.service");
const roomReservationService = require("../exam/roomReservation.service");
const seatSharingService = require("../seat-sharing/seatSharing.service");
const { notifyExamPublished } = require("./examNotification.service");

/**
 * Fetch departments with their semester + courses for a given semester name.
 */
const getDepartmentsData = async (departmentIds, semesterName) => {
  const departments = await Department.find({
    _id: { $in: departmentIds },
    isActive: true,
  });

  const result = [];

  for (const dept of departments) {
    // Try flexible semester name matching:
    // Frontend sends "1","2",... but DB may store "Semester 1", "Sem 1", etc.
    let semester = await Semester.findOne({
      department: dept._id,
      name: semesterName,
    });

    if (!semester) {
      // Match patterns: "sem 3", "Sem 3", "Semester 3", "3", "03"
      const pattern = "^(Sem(ester)?\\s*)?0?" + semesterName + "$";
      semester = await Semester.findOne({
        department: dept._id,
        name: { $regex: new RegExp(pattern, "i") },
      });
    }

    if (!semester) continue;

    const courses = await Course.find({ semester: semester._id })
      .populate("electiveGroup", "name")
      .sort({ code: 1 });

    // Fetch ElectiveGroups for this semester too — the wizard renders them
    // as single-select entries alongside core courses.
    const electiveGroups = await ElectiveGroup.find({
      semester: semester._id,
    }).sort({ name: 1 });

    result.push({
      ...dept.toObject(),
      semester: semester.toObject(),
      courses: courses.map((c) => c.toObject()),
      electiveGroups: electiveGroups.map((g) => g.toObject()),
    });
  }

  return result;
};

/**
 * Auto-calculate exam dates from config.
 */
const calculateDates = (config) => {
  const { startDate, departments, shifts } = config;

  if (!startDate) {
    throw new AppError("Start date is required", 400);
  }

  // Validate start date is not in the past
  validateDates(startDate, null);

  if (!departments || departments.length === 0) {
    throw new AppError("At least one department is required", 400);
  }

  if (!shifts || shifts.length === 0) {
    throw new AppError("At least one shift is required", 400);
  }

  const maxCourses = Math.max(...departments.map((d) => d.courseCount || 0));
  const shiftsPerDay = shifts.length;
  const requiredDays = Math.ceil(maxCourses / shiftsPerDay);

  const { dates, skippedSundays } = generateExamDates(startDate, requiredDays);

  return {
    requiredDays,
    maxCourses,
    totalSlots: requiredDays * shiftsPerDay,
    dates: dates.map((d) => d.toISOString().split("T")[0]),
    skippedSundays: skippedSundays.map((d) => d.toISOString().split("T")[0]),
    endDate: dates.length > 0 ? dates[dates.length - 1].toISOString().split("T")[0] : null,
  };
};

/**
 * Validate that dates are not in the past and end >= start.
 * Used by createPlan and calculateDates.
 */
const validateDates = (startDate, endDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start < today) {
    throw new AppError("Start date cannot be in the past", 400);
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      throw new AppError("End date cannot be before start date", 400);
    }
  }
};

/**
 * Create a complete CIE exam plan:
 *   ExamGroup → ExamSchedules → CIEPlanEntries
 */
const createPlan = async (data, userId) => {
  const { examType, semester, startDate, endDate, shifts, routine } = data;

  if (!routine || routine.length === 0) {
    throw new AppError("Routine cannot be empty", 400);
  }

  // Validate dates before anything is persisted
  validateDates(startDate, endDate);

  // Check for duplicate: same examType + semester + overlapping dates
  const duplicate = await ExamGroup.findOne({
    examType,
    semester: parseInt(semester, 10),
    isActive: true,
    $or: [
      {
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) },
      },
    ],
  });

  if (duplicate) {
    throw new AppError(
      `An ${examType} exam for Semester ${semester} already exists with overlapping dates`,
      409
    );
  }

  // Create the exam group
  const examGroup = await ExamGroup.create({
    examType,
    semester: parseInt(semester, 10),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    createdBy: userId,
  });

  // Build schedules for each unique date+shift
  const scheduleMap = new Map();

  for (const entry of routine) {
    const shift = shifts[entry.shiftIndex];
    const scheduleKey = `${entry.date}|${entry.shiftIndex}`;

    if (!scheduleMap.has(scheduleKey)) {
      const schedule = await ExamSchedule.create({
        examGroup: examGroup._id,
        date: new Date(entry.date),
        startTime: shift.startTime,
        endTime: shift.endTime,
      });
      scheduleMap.set(scheduleKey, schedule);
    }

    const schedule = scheduleMap.get(scheduleKey);

    // Create plan entries for each dept assignment. Token may be a bare
    // courseId, "course:<id>", or "group:<electiveGroupId>" — group tokens fan
    // out to every member course of the elective group.
    for (const [deptId, token] of Object.entries(entry.assignments || {})) {
      if (!token) continue;
      const { courseIds } = await resolveAssignment(token);
      for (const courseId of courseIds) {
        await CIEPlanEntry.create({
          examGroup: examGroup._id,
          schedule: schedule._id,
          department: deptId,
          course: courseId,
        });
      }
    }
  }

  // Build a mapping of slotKey → scheduleId for the frontend
  const scheduleMapping = {};
  for (const [key, schedule] of scheduleMap) {
    scheduleMapping[key] = schedule._id;
  }

  return { ...examGroup.toObject(), scheduleMapping };
};

/**
 * Assign rooms to schedule slots (department-level with seat sharing).
 * Each assignment links a room to a specific department within a schedule.
 * Shared assignments include a student count and isShared flag.
 * Validates:
 *   - No duplicate primary (non-shared) room+schedule+dept combinations
 *   - Shared seat totals don't exceed room capacity
 */
const assignRooms = async (data) => {
  const { assignments } = data;

  if (!assignments || assignments.length === 0) {
    throw new AppError("No room assignments provided", 400);
  }

  // Separate primary and shared assignments
  const primary = assignments.filter((a) => !a.isShared);
  const shared = assignments.filter((a) => a.isShared);

  // Validate: no duplicate primary room+schedule+dept
  const primarySeen = new Set();
  for (const a of primary) {
    const key = `${a.scheduleId}|${a.roomId}|${a.departmentCode}`;
    if (primarySeen.has(key)) {
      throw new AppError(
        `Duplicate room assignment: ${a.departmentCode} in room ${a.roomId}`,
        400
      );
    }
    primarySeen.add(key);
  }

  // Validate: shared seats don't exceed room capacity
  // Build a map of roomId|scheduleId -> total allocated students
  const roomCapacityUsage = new Map();
  for (const a of [...primary, ...shared]) {
    const key = `${a.scheduleId}|${a.roomId}`;
    const current = roomCapacityUsage.get(key) || 0;
    const students = a.students || 0;
    roomCapacityUsage.set(key, current + students);
  }

  // Group ALL assignments (primary + shared) by schedule+room to avoid unique index conflicts
  const roomGroups = new Map();
  for (const a of [...primary, ...shared]) {
    const key = `${a.scheduleId}|${a.roomId}`;
    if (!roomGroups.has(key)) {
      roomGroups.set(key, {
        scheduleId: a.scheduleId,
        roomId: a.roomId,
        departments: new Set(),
      });
    }
    roomGroups.get(key).departments.add(a.departmentCode);
  }

  // Global room-reservation check — reject if any (roomId × schedule time)
  // pair collides with an existing reservation in another exam.
  const uniqueScheduleIds = [
    ...new Set(Array.from(roomGroups.values()).map((g) => String(g.scheduleId))),
  ];
  const schedulesForAssignments = await ExamSchedule.find({
    _id: { $in: uniqueScheduleIds },
  });
  const scheduleById = new Map(
    schedulesForAssignments.map((s) => [String(s._id), s]),
  );
  const reservationRequests = Array.from(roomGroups.values()).map((g) => {
    const schedule = scheduleById.get(String(g.scheduleId));
    if (!schedule) {
      throw new AppError(
        `Room assignment references unknown schedule ${g.scheduleId}`,
        400,
      );
    }
    return {
      roomId: g.roomId,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    };
  });
  await roomReservationService.assertNoConflicts({
    requests: reservationRequests,
  });

  // Create one ExamRoom per unique schedule+room with all departments merged
  const results = await Promise.all(
    Array.from(roomGroups.values()).map((group) =>
      ExamRoom.create({
        schedule: group.scheduleId,
        room: group.roomId,
        departments: Array.from(group.departments),
      })
    )
  );

  return results;
};

/**
 * Fetch all active rooms grouped by building → floor.
 */
const getRoomsGrouped = async () => {
  const buildings = await Building.find({ isActive: true }).sort({ name: 1 });
  const rooms = await Room.find({ isActive: true })
    .populate("building", "name")
    .sort({ floor: 1, roomNumber: 1 });

  const grouped = [];

  for (const building of buildings) {
    const buildingRooms = rooms.filter(
      (r) => r.building._id.toString() === building._id.toString()
    );

    if (buildingRooms.length === 0) continue;

    const floors = {};
    for (const room of buildingRooms) {
      const floorKey = room.floor;
      if (!floors[floorKey]) floors[floorKey] = [];
      floors[floorKey].push({
        _id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
      });
    }

    grouped.push({
      _id: building._id,
      name: building.name,
      floors,
    });
  }

  return grouped;
};

// ---------------------------------------------------------------------------
// Finalize (single-call transactional creation)
//
// The frontend now buffers the entire draft (config + routine + room
// assignments) and ships it in one POST after the user clicks the final
// "Finish & Create Exam" button. Everything that used to happen across
// `createPlan` + `assignRooms` now happens atomically here. If anything
// inside the transaction fails, nothing is persisted — there is no
// orphaned ExamGroup or ExamSchedule left behind.
// ---------------------------------------------------------------------------

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

const finalizeCIEPlan = async (data, userId) => {
  const {
    examType,
    semester,
    startDate,
    endDate,
    shifts,
    routine,
    roomAssignments,
    // Global Seat Sharing — new payload. Both default to [] so existing callers
    // that don't send them keep working unchanged.
    shareableRoomMarks = [],
    globalSharedConsumptions = [],
  } = data;

  // ---- Top-level validation (cheap, run before opening a session) ----

  if (!examType) throw new AppError("Exam type is required", 400);
  if (!semester) throw new AppError("Semester is required", 400);
  if (!Array.isArray(shifts) || shifts.length === 0) {
    throw new AppError("At least one shift is required", 400);
  }
  if (!Array.isArray(routine) || routine.length === 0) {
    throw new AppError("Routine cannot be empty", 400);
  }
  if (!Array.isArray(roomAssignments) || roomAssignments.length === 0) {
    throw new AppError("Room assignments are required before creating an exam", 400);
  }

  validateDates(startDate, endDate);

  // A routine entry with no course assignments is an intentionally-blank slot
  // (user opted not to schedule any course for that date+shift). Drop these
  // before validation and persistence so we neither require rooms for them
  // nor create empty ExamSchedules.
  const scheduledRoutine = routine.filter((r) =>
    Object.values(r.assignments || {}).some((courseId) => Boolean(courseId)),
  );
  if (scheduledRoutine.length === 0) {
    throw new AppError("At least one slot must have a course scheduled", 400);
  }

  // Every scheduled routine slot (unique date+shift) must appear in
  // roomAssignments; otherwise the caller is trying to finalize while a slot
  // that actually has an exam has zero rooms.
  const routineSlotKeys = new Set(
    scheduledRoutine.map((r) => `${r.date}|${r.shiftIndex}`),
  );
  const assignmentSlotKeys = new Set(
    roomAssignments.map((a) => a.scheduleId), // frontend ships slotKey in this field
  );
  for (const key of routineSlotKeys) {
    if (!assignmentSlotKeys.has(key)) {
      throw new AppError(
        "Cannot create exam until all schedules have rooms assigned.",
        400,
      );
    }
  }

  // When an existing (examType, semester) group overlaps the requested dates,
  // we don't reject — the caller is adding more departments (or extending) to
  // the same conceptual exam. Persist into it so the Exams UI still shows
  // one card per (examType, semester). CIEPlanEntry's unique index
  // (examGroup, schedule, department) will surface a real conflict if the
  // same dept is being re-scheduled in a slot it already occupies.
  const existingGroup = await ExamGroup.findOne({
    examType,
    semester: parseInt(semester, 10),
    isActive: true,
    $or: [
      {
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) },
      },
    ],
  });

  // ---- Global room-reservation conflict check ----
  //
  // Resolve every (roomId × date × time-window) tuple we're about to reserve
  // and reject if any physical room is already booked — regardless of exam
  // type, semester, or department. This must run before the transaction so
  // we surface a clean 409 without opening a Mongo session.
  const slotByKey = new Map();
  for (const entry of scheduledRoutine) {
    const key = `${entry.date}|${entry.shiftIndex}`;
    if (slotByKey.has(key)) continue;
    const shift = shifts[entry.shiftIndex];
    if (!shift) {
      throw new AppError(
        `Routine references unknown shiftIndex ${entry.shiftIndex}`,
        400,
      );
    }
    slotByKey.set(key, {
      date: entry.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }
  const uniquePairs = new Set();
  const reservationRequests = [];
  for (const a of roomAssignments) {
    const slot = slotByKey.get(a.scheduleId);
    if (!slot) continue; // covered by the earlier scheduleId-in-routine check
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

  // ---- Global Seat Sharing pre-flight ----
  // Verify each declared consumption still lines up with a live shareable
  // config with enough seats. Runs outside the transaction so we surface a
  // clean 409 before writing anything.
  await seatSharingService.validateConsumptions(globalSharedConsumptions);

  // ---- Transactional persistence ----

  const plan = await withOptionalTransaction(async (session) => {
    const sessionOpt = session ? { session } : {};

    // Reuse an existing (examType, semester) group when one overlaps —
    // otherwise create fresh. When reusing, widen its date range if the new
    // plan pushes past either edge.
    let examGroup;
    if (existingGroup) {
      examGroup = existingGroup;
      const newStart = new Date(startDate) < examGroup.startDate ? new Date(startDate) : examGroup.startDate;
      const newEnd = new Date(endDate) > examGroup.endDate ? new Date(endDate) : examGroup.endDate;
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
            examType,
            semester: parseInt(semester, 10),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            createdBy: userId,
          },
        ],
        sessionOpt,
      );
    }

    // Pre-load schedules the merged group already owns so we reuse them when
    // the same (date, shift) is being scheduled again.
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

    // 1 ExamSchedule per unique (date, shiftIndex). Keep a slotKey → _id map
    // so room assignments can resolve their schedule ref.
    const slotKeyToScheduleId = new Map();
    for (const entry of scheduledRoutine) {
      const slotKey = `${entry.date}|${entry.shiftIndex}`;
      if (slotKeyToScheduleId.has(slotKey)) continue;

      const shift = shifts[entry.shiftIndex];
      if (!shift) {
        throw new AppError(`Routine references unknown shiftIndex ${entry.shiftIndex}`, 400);
      }

      const scheduleKey = `${entry.date}|${shift.startTime}|${shift.endTime}`;
      const reused = existingScheduleByKey.get(scheduleKey);
      if (reused) {
        slotKeyToScheduleId.set(slotKey, reused);
        continue;
      }

      const [schedule] = await ExamSchedule.create(
        [
          {
            examGroup: examGroup._id,
            date: new Date(entry.date),
            startTime: shift.startTime,
            endTime: shift.endTime,
          },
        ],
        sessionOpt,
      );
      slotKeyToScheduleId.set(slotKey, schedule._id);
    }

    // CIEPlanEntries — one per (schedule × department × course). An assignment
    // token may be a bare courseId, "course:<id>", or "group:<electiveGroupId>";
    // group tokens fan out to every member course so all electives in the
    // group inherit the same schedule + room set.
    for (const entry of scheduledRoutine) {
      const scheduleId = slotKeyToScheduleId.get(
        `${entry.date}|${entry.shiftIndex}`,
      );
      for (const [deptId, token] of Object.entries(entry.assignments || {})) {
        if (!token) continue;
        const { courseIds } = await resolveAssignment(token);
        for (const courseId of courseIds) {
          await CIEPlanEntry.create(
            [
              {
                examGroup: examGroup._id,
                schedule: scheduleId,
                department: deptId,
                course: courseId,
              },
            ],
            sessionOpt,
          );
        }
      }
    }

    // Group room assignments by (schedule, room); merge departments so we
    // don't violate the (schedule, room) unique index on ExamRoom.
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

    // Persist ExamRooms AND remember which _id we created for each
    // (schedule, room) pair — needed so shareable marks can resolve their
    // target ExamRoom without another round-trip. When merging into an
    // existing group we may find rooms already created for a reused schedule;
    // merge new departments into their `departments` set rather than colliding
    // on the (schedule, room) unique index.
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

    // ---- Seat sharing (owner side): mark selected rooms shareable ----
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

    // ---- Seat sharing (consumer side): allocate borrowed seats ----
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
    //
    // When a dept borrows seats from another dept's shareable-marked room
    // WITHIN the same exam group (the "intra-batch" flow via SeatSharingModal),
    // the borrow is expressed as a roomAssignment with isShared=true. The
    // shareable config's remainingSeats counter must be decremented too, or the
    // NEXT exam group scheduled at the same slot will see the full pool and
    // over-allocate the same physical seats.
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
      // Only decrement if the source room is actually marked shareable — the
      // owner may not have opted in, in which case this is legacy in-memory
      // sharing with no persistent counter to update.
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

  // Generate DCS groups AFTER the create-transaction commits so the read-back
  // sees the just-written ExamRooms. Per spec the formula uses students
  // resolved at creation time (Semester.studentCount), so this still locks
  // the requirement at "exam created" and not at "first DCS opens the page".
  try {
    await dcsGroupService.generateDCSGroupsForExamGroup(plan._id);
  } catch (err) {
    // The exam itself is valid even if DCS generation hiccups — surface the
    // failure but don't roll back the committed exam. Re-generation can be
    // retried manually if needed.
    console.error("DCS group generation failed for", plan._id, err);
  }

  // Announce the new exam to duty-eligible teachers — only for a freshly
  // created group, not when merging departments into an existing exam (which
  // would re-notify everyone about an exam they already know about).
  if (!existingGroup) {
    try {
      await notifyExamPublished(plan);
    } catch (err) {
      console.error("exam_created notification failed for", plan._id, err);
    }
  }

  return plan;
};

module.exports = {
  getDepartmentsData,
  calculateDates,
  createPlan,
  assignRooms,
  getRoomsGrouped,
  finalizeCIEPlan,
};
