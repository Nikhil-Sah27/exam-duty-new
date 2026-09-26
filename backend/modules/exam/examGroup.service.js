const AppError = require("../../shared/utils/AppError");
const examGroupRepo = require("./examGroup.repository");
const examScheduleRepo = require("./examSchedule.repository");
const examRoomRepo = require("./examRoom.repository");
const examDeletionService = require("../exam-cleanup/services/examDeletionService");

const ExamGroup = require("./examGroup.model");
const Duty = require("../duty/duty.model");
const CIEPlanEntry = require("../create-exams/ciePlan.model");
const SharedSeatAllocation = require("../seat-sharing/sharedSeatAllocation.model");

const createGroup = async (data, userId) => {
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    throw new AppError("End date must be after start date", 400);
  }

  // Check for duplicate: same examType + semester + overlapping dates
  const duplicate = await ExamGroup.findOne({
    examType: data.examType,
    semester: Number(data.semester),
    isActive: true,
    $or: [
      // New exam overlaps with existing
      {
        startDate: { $lte: new Date(data.endDate) },
        endDate: { $gte: new Date(data.startDate) },
      },
    ],
  });

  if (duplicate) {
    throw new AppError(
      `An ${data.examType} exam for Semester ${data.semester} already exists with overlapping dates`,
      409
    );
  }

  return examGroupRepo.create({ ...data, createdBy: userId });
};

const getAllGroups = async (query = {}) => {
  const filter = {};
  if (query.examType) filter.examType = query.examType;
  if (query.semester) filter.semester = Number(query.semester);

  return examGroupRepo.findAllWithStats(filter);
};

const getGroupById = async (id) => {
  const group = await examGroupRepo.findById(id);
  if (!group) throw new AppError("Exam group not found", 404);
  return group;
};

const updateGroup = async (id, data) => {
  const group = await examGroupRepo.findById(id);
  if (!group) throw new AppError("Exam group not found", 404);

  if (data.startDate && data.endDate) {
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      throw new AppError("End date must be after start date", 400);
    }
  }

  return examGroupRepo.updateById(id, data);
};

// Delegates to the centralized cascade so duties are released, change
// requests cancelled, audit logged, and teachers notified — atomically.
const deleteGroup = async (id, actor = {}) => {
  return examDeletionService.deleteExamGroupWithCleanup(id, actor);
};

/**
 * Get full details for exam group: group info + schedules + rooms per schedule.
 *
 * Each schedule additionally carries a `courses` array — one entry per
 * (department × course) that's tied to that schedule via CIEPlanEntry. The
 * UI uses this to display "what subject is being written in this room?" in
 * the room-details modal. Field is purely additive (existing consumers of
 * this endpoint ignore it).
 */
const getGroupDetails = async (id) => {
  const group = await examGroupRepo.findById(id);
  if (!group) throw new AppError("Exam group not found", 404);

  const schedules = await examScheduleRepo.findByExamGroup(id);
  const scheduleIds = schedules.map((s) => s._id);
  const allRooms = await examRoomRepo.findBySchedules(scheduleIds);

  // Pull every plan entry for this exam group in one query and group by
  // schedule. Populating the course gives us code + name without a second
  // round trip. The department ref is kept as a code via populate to match
  // the (string) codes already stored on ExamRoom.departments.
  const planEntries = await CIEPlanEntry.find({ examGroup: id })
    .populate({
      path: "course",
      select: "code name credits courseType electiveGroup",
      populate: { path: "electiveGroup", select: "name" },
    })
    .populate({ path: "department", select: "code name" });

  const toScheduleCourse = (entry) => {
    const eg = entry.course?.electiveGroup;
    return {
      courseId: entry.course?._id,
      courseCode: entry.course?.code || null,
      courseTitle: entry.course?.name || null,
      credits: entry.course?.credits || null,
      courseType: entry.course?.courseType || null,
      electiveGroupId: eg?._id || null,
      electiveGroupName: eg?.name || null,
      departmentCode: entry.department?.code || null,
      departmentName: entry.department?.name || null,
    };
  };

  const coursesBySchedule = new Map();
  for (const entry of planEntries) {
    const key = entry.schedule.toString();
    if (!coursesBySchedule.has(key)) coursesBySchedule.set(key, []);
    coursesBySchedule.get(key).push(toScheduleCourse(entry));
  }

  // Cross-group seat-sharing consumers: a dept from a DIFFERENT exam group
  // may be sitting in one of our rooms via SharedSeatAllocation. Their course
  // lives on their own group's schedule, so we resolve it here and merge it
  // into the source room's schedule course list. Downstream `forDepartments`
  // filters (applied per-room by the frontend) then surface the borrowed
  // course only in the room where the borrow actually happens.
  if (allRooms.length > 0) {
    const sourceRoomIds = allRooms.map((r) => r._id);
    const roomToScheduleKey = new Map(
      allRooms.map((r) => [String(r._id), String(r.schedule)])
    );
    const allocs = await SharedSeatAllocation.find({
      sourceExamRoom: { $in: sourceRoomIds },
    }).lean();

    if (allocs.length > 0) {
      const consumerScheduleIds = [
        ...new Set(allocs.map((a) => String(a.consumerSchedule))),
      ];
      const consumerEntries = await CIEPlanEntry.find({
        schedule: { $in: consumerScheduleIds },
      })
        .populate({
          path: "course",
          select: "code name credits courseType electiveGroup",
          populate: { path: "electiveGroup", select: "name" },
        })
        .populate({ path: "department", select: "code name" });

      const consumerByKey = new Map();
      for (const e of consumerEntries) {
        const key = `${String(e.schedule)}|${(e.department?.code || "").toUpperCase()}`;
        const list = consumerByKey.get(key) || [];
        list.push(toScheduleCourse(e));
        consumerByKey.set(key, list);
      }

      for (const alloc of allocs) {
        const sourceScheduleKey = roomToScheduleKey.get(String(alloc.sourceExamRoom));
        if (!sourceScheduleKey) continue;
        const deptCode = (alloc.consumerDepartmentCode || "").toUpperCase();
        const lookupKey = `${String(alloc.consumerSchedule)}|${deptCode}`;
        const consumerCourses = consumerByKey.get(lookupKey) || [];
        if (consumerCourses.length === 0) continue;

        const bucket = coursesBySchedule.get(sourceScheduleKey) || [];
        const existingKeys = new Set(
          bucket.map(
            (c) =>
              `${(c.departmentCode || "").toUpperCase()}|${c.courseId || c.courseCode || ""}`
          )
        );
        for (const c of consumerCourses) {
          const key = `${(c.departmentCode || "").toUpperCase()}|${c.courseId || c.courseCode || ""}`;
          if (existingKeys.has(key)) continue;
          bucket.push(c);
          existingKeys.add(key);
        }
        coursesBySchedule.set(sourceScheduleKey, bucket);
      }
    }
  }

  // Map rooms to their schedule
  const roomsBySchedule = new Map();
  for (const room of allRooms) {
    const key = room.schedule.toString();
    if (!roomsBySchedule.has(key)) roomsBySchedule.set(key, []);
    roomsBySchedule.get(key).push(room);
  }

  const schedulesWithRooms = schedules.map((s) => ({
    ...s.toObject(),
    rooms: roomsBySchedule.get(s._id.toString()) || [],
    courses: coursesBySchedule.get(s._id.toString()) || [],
  }));

  return {
    ...group.toObject(),
    schedules: schedulesWithRooms,
  };
};

/**
 * Get duty assignment status for every room in an exam group.
 * Returns a map: { [examRoomId]: { dcsAssigned, rsAssigned, invigilatorAssigned } }
 */
const getDutyStatus = async (id) => {
  const group = await examGroupRepo.findById(id);
  if (!group) throw new AppError("Exam group not found", 404);

  const schedules = await examScheduleRepo.findByExamGroup(id);
  const scheduleIds = schedules.map((s) => s._id);
  const allRooms = await examRoomRepo.findBySchedules(scheduleIds);

  // Build a schedule lookup for quick date/time access
  const scheduleMap = new Map();
  for (const s of schedules) {
    scheduleMap.set(s._id.toString(), s);
  }

  // For each exam room, query matching duties by date + time + room identifier
  const statusMap = {};

  for (const examRoom of allRooms) {
    const schedule = scheduleMap.get(examRoom.schedule.toString());
    if (!schedule) {
      statusMap[examRoom._id] = { dcsAssigned: false, rsAssigned: false, invigilatorAssigned: false };
      continue;
    }

    // Match duties by the physical Room _id (building-scoped). The legacy
    // string `room` field is not building-aware and would produce false
    // positives when the same room number exists in a different block.
    const roomRef = examRoom.room?._id || null;
    const roomNumber = examRoom.room?.roomNumber || "";
    const roomId = examRoom.room?._id?.toString() || "";

    const scheduleDate = new Date(schedule.date);
    scheduleDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(scheduleDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const dutyFilter = {
      date: { $gte: scheduleDate, $lt: nextDay },
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: "assigned",
    };
    if (roomRef) {
      // Primary path: roomRef matches (post-backfill duties, all new duties).
      // Also include legacy duties that predate roomRef by falling back to the
      // string room label — but only when roomRef is null, so we can't falsely
      // absorb a different-building duty that already has its own roomRef set.
      dutyFilter.$or = [
        { roomRef },
        {
          roomRef: null,
          $or: [
            { room: roomNumber },
            { room: roomId },
            { room: { $regex: new RegExp(`\\b${roomNumber}\\b`) } },
          ],
        },
      ];
    } else {
      dutyFilter.$or = [
        { room: roomNumber },
        { room: roomId },
        { room: { $regex: new RegExp(`\\b${roomNumber}\\b`) } },
      ];
    }
    const duties = await Duty.find(dutyFilter).populate("teacher", "name email phone roles department designation");

    // Split by the DUTY's role field — this identifies the exact slot the duty
    // was claimed for, which is unambiguous even when a teacher holds multiple
    // roles (e.g. Associate Professor with roles=[rs, invigilator]).
    const dcsTeacher = duties.find((d) => d.role === "dcs")?.teacher;
    const rsTeacher = duties.find((d) => d.role === "rs")?.teacher;
    const invigilatorTeacher = duties.find((d) => d.role === "invigilator")?.teacher;

    const toPublic = (u) =>
      u
        ? {
            _id: u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || null,
            roles: u.roles || [],
            department: u.department || null,
            designation: u.designation || null,
          }
        : null;

    statusMap[examRoom._id] = {
      dcsAssigned: Boolean(dcsTeacher),
      rsAssigned: Boolean(rsTeacher),
      invigilatorAssigned: Boolean(invigilatorTeacher),
      dcsTeacher: toPublic(dcsTeacher),
      rsTeacher: toPublic(rsTeacher),
      invigilatorTeacher: toPublic(invigilatorTeacher),
    };
  }

  return statusMap;
};

module.exports = {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  getGroupDetails,
  getDutyStatus,
};
