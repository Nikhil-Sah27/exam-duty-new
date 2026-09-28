const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");

const dcsGroupRepository = require("./dcsGroup.repository");
const dutyRepository = require("../duty/duty.repository");
const examScheduleRepository = require("../exam/examSchedule.repository");
const examRoomRepository = require("../exam/examRoom.repository");
const examGroupRepository = require("../exam/examGroup.repository");

const Department = require("../department/department.model");
const Semester = require("../department/semester.model");
const User = require("../auth/auth.model");
const Duty = require("../duty/duty.model");
const { emit } = require("../notification/notification.emitter");

const {
  calculateRequiredDCS,
  distributeClasses,
} = require("./dcsCalculation.utils");

// Sort by leading-numeric portion of the room number, then by the full string
// as a tiebreaker — same algorithm as the RS frontend grouping. Inlined here
// because the backend has no equivalent shared util and pulling in a new
// shared module just for this would be overkill.
const NUMERIC_PREFIX_RE = /^(\d+)/;
const compareRoomNumbers = (a, b) => {
  const am = a.match(NUMERIC_PREFIX_RE);
  const bm = b.match(NUMERIC_PREFIX_RE);
  if (am && bm) {
    const an = Number(am[1]);
    const bn = Number(bm[1]);
    if (an !== bn) return an - bn;
  } else if (am) {
    return -1;
  } else if (bm) {
    return 1;
  }
  return a.localeCompare(b);
};

// ──────────────────────────────────────────────────────────────
// Student-count resolution
// ──────────────────────────────────────────────────────────────

/**
 * Sum Semester.studentCount for the (dept × examGroup.semester) pairs
 * represented in `examRooms`. A department is counted once per schedule even
 * if it appears in multiple rooms — its entire semester sits across those
 * rooms, so per-room summing would double-count.
 */
const resolveStudentCount = async (examRooms, semesterNumber) => {
  const codes = new Set();
  for (const er of examRooms) {
    for (const code of er.departments || []) {
      if (code) codes.add(String(code).toUpperCase());
    }
  }
  if (codes.size === 0) return { total: 0, perDepartment: {} };

  const depts = await Department.find({ code: { $in: [...codes] } });
  const semName = String(semesterNumber);

  const perDepartment = {};
  let total = 0;
  for (const dept of depts) {
    const sem = await Semester.findOne({
      department: dept._id,
      name: semName,
    });
    const count = sem?.studentCount || 0;
    perDepartment[dept.code] = count;
    total += count;
  }
  return { total, perDepartment };
};

// ──────────────────────────────────────────────────────────────
// Group generation (called from cie/see finalize)
// ──────────────────────────────────────────────────────────────

const generateGroupsForSchedule = async (
  schedule,
  examGroup,
  examRooms,
  session
) => {
  // Sort rooms numerically so distribution is deterministic and chunk-1 owns
  // the lowest-numbered classrooms (matches the printed seating plan order).
  const sortedRooms = [...examRooms].sort((a, b) =>
    compareRoomNumbers(
      a.room?.roomNumber || "",
      b.room?.roomNumber || ""
    )
  );

  const { total: totalStudents } = await resolveStudentCount(
    sortedRooms,
    examGroup.semester
  );

  // Fall back to "1 DCS" when student data is missing but there are rooms to
  // staff — we never want a schedule with rooms and zero DCS slots.
  let dcsRequired = calculateRequiredDCS(totalStudents);
  if (dcsRequired === 0 && sortedRooms.length > 0) dcsRequired = 1;
  if (dcsRequired === 0) return [];

  const buckets = distributeClasses(sortedRooms, dcsRequired);

  const docs = buckets.map((bucket, i) => {
    const deptSet = new Set();
    for (const room of bucket) {
      for (const code of room.departments || []) {
        deptSet.add(String(code).toUpperCase());
      }
    }
    // Per-group student count is best-effort: total split evenly by base+rem.
    // Exact per-room counts aren't stored anywhere on ExamRoom, so we attribute
    // proportionally to room count within the schedule.
    const perGroupStudents =
      sortedRooms.length > 0
        ? Math.round((totalStudents * bucket.length) / sortedRooms.length)
        : 0;

    return {
      examGroup: examGroup._id,
      schedule: schedule._id,
      groupIndex: i + 1,
      dcsRequired,
      assignedRooms: bucket.map((r) => r._id),
      assignedDepartments: [...deptSet].sort(),
      assignedStudents: perGroupStudents,
      assignedTeacher: null,
      status: "open",
    };
  });

  return dcsGroupRepository.insertMany(docs, session);
};

/**
 * Public entry point: called once at exam-creation time, after ExamRooms have
 * been written. Walks every schedule in the new ExamGroup and lays down a
 * DCSGroup row per chunk. Idempotent within a transaction — caller is expected
 * to invoke this exactly once per group.
 */
const generateDCSGroupsForExamGroup = async (examGroupId, session) => {
  const examGroup = await examGroupRepository.findById(examGroupId);
  if (!examGroup) throw new AppError("Exam group not found", 404);

  const schedules = await examScheduleRepository.findByExamGroup(examGroupId);
  if (schedules.length === 0) return [];

  const allGroups = [];
  for (const schedule of schedules) {
    const examRooms = await examRoomRepository.findBySchedule(schedule._id);
    if (examRooms.length === 0) continue;
    const created = await generateGroupsForSchedule(
      schedule,
      examGroup,
      examRooms,
      session
    );
    allGroups.push(...created);
  }
  return allGroups;
};

// ──────────────────────────────────────────────────────────────
// Read APIs
// ──────────────────────────────────────────────────────────────

const listGroups = async (query = {}) => {
  const filter = {};
  if (query.examGroup) filter.examGroup = query.examGroup;
  if (query.schedule) filter.schedule = query.schedule;
  if (query.status) filter.status = query.status;
  return dcsGroupRepository.findAll(filter);
};

const getGroupById = async (id) => {
  const group = await dcsGroupRepository.findById(id);
  if (!group) throw new AppError("DCS group not found", 404);
  return group;
};

const getMyGroups = async (teacherId) => {
  return dcsGroupRepository.findByTeacher(teacherId);
};

// ──────────────────────────────────────────────────────────────
// Claim / release (DCS self-assignment)
// ──────────────────────────────────────────────────────────────

const validateDcsUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (!user.isActive) throw new AppError("Account is deactivated", 400);
  if (!(user.roles || []).includes("dcs")) {
    throw new AppError("Only DCS users can claim DCS groups", 403);
  }
  return user;
};

/**
 * Core claim implementation shared by self-claim and admin-claim. Creates one
 * Duty per assigned room in a single transaction and marks the group as
 * `claimed` for `assigneeId`. `assignedById` is stamped on each Duty (either
 * the same user for self-claim, or the CS admin for admin-claim). When
 * `notify` is true, one `duty_assigned` notification per created duty fires
 * against the assignee's bell.
 */
const _performClaim = async (
  groupId,
  { assigneeId, assignedById, isSelfAssigned, notify }
) => {
  await validateDcsUser(assigneeId);

  const group = await dcsGroupRepository.findById(groupId);
  if (!group) throw new AppError("DCS group not found", 404);
  if (group.status === "claimed") {
    throw new AppError("This DCS group is already taken", 409);
  }
  if (!group.assignedRooms?.length) {
    throw new AppError("DCS group has no rooms to supervise", 400);
  }

  // Per-schedule lifecycle gate — mirrors the frontend `isDutySelectable`
  // filter. Past schedules (and same-day schedules that have ended) cannot
  // be claimed even if the caller forges a request bypassing the UI.
  const now = new Date();
  const day = new Date(group.schedule.date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) {
    throw new AppError("Cannot claim — schedule has already passed", 400);
  }
  if (day.getTime() === today.getTime()) {
    const [eh, em] = (group.schedule.endTime || "").split(":").map(Number);
    if (Number.isFinite(eh) && Number.isFinite(em)) {
      const endMin = eh * 60 + em;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= endMin) {
        throw new AppError("Cannot claim — schedule has already ended", 400);
      }
    }
  }

  // Block teacher double-booking at the same time.
  const conflict = await dutyRepository.findTeacherConflict(
    assigneeId,
    group.schedule.date,
    group.schedule.startTime,
    group.schedule.endTime
  );
  if (conflict) {
    const who = isSelfAssigned ? "You" : "Teacher";
    throw new AppError(
      `${who} already has a duty at ${conflict.room} from ${conflict.startTime}–${conflict.endTime} on this date`,
      409
    );
  }

  const createdIds = await withOptionalTransaction(async (session) => {
    // Re-read under transaction to avoid a double-claim race.
    const fresh = await dcsGroupRepository.findById(groupId);
    if (!fresh) throw new AppError("DCS group not found", 404);
    if (fresh.status === "claimed") {
      throw new AppError("This DCS group is already taken", 409);
    }

    const dutyIds = [];
    for (const examRoom of fresh.assignedRooms) {
      const roomNumber = examRoom?.room?.roomNumber || "";
      const roomRef = examRoom?.room?._id || null;
      const duty = await dutyRepository.create(
        {
          exam: null,
          examSchedule: fresh.schedule._id,
          examRoom: examRoom._id,
          teacher: assigneeId,
          role: "dcs",
          room: roomNumber,
          roomRef,
          date: fresh.schedule.date,
          startTime: fresh.schedule.startTime,
          endTime: fresh.schedule.endTime,
          assignedBy: assignedById,
          isSelfAssigned,
        },
        session
      );
      dutyIds.push(duty._id);
    }

    await dcsGroupRepository.updateById(
      groupId,
      {
        assignedTeacher: assigneeId,
        status: "claimed",
        duties: dutyIds,
      },
      session
    );

    return dutyIds;
  });

  if (notify) {
    // ONE notification for the whole group — a DCS supervises the group as a
    // unit, so per-room alerts were just noise (5 rooms → 5 bells).
    emit("duty_group_assigned", {
      recipient: assigneeId,
      refModel: "Duty",
      refId: createdIds[0] || null,
      data: {
        roleLabel: "DCS",
        roomCount: createdIds.length,
        date: group.schedule.date,
        startTime: group.schedule.startTime,
        endTime: group.schedule.endTime,
        examLabel: group.examGroup?.examType,
        semester: group.examGroup?.semester,
      },
    });
  }

  const finalGroup = await dcsGroupRepository.findById(groupId);
  return { group: finalGroup, dutyIds: createdIds };
};

const claimGroup = (groupId, userId) =>
  _performClaim(groupId, {
    assigneeId: userId,
    assignedById: userId,
    isSelfAssigned: true,
    notify: false,
  });

/**
 * CS admin-assigns a DCS group to a specific teacher. Same transactional
 * semantics as a self-claim, but the caller is the admin and the assignee
 * is the target teacher; every created duty gets a `duty_assigned`
 * notification.
 */
const adminClaimGroup = (groupId, targetTeacherId, adminId) => {
  if (!targetTeacherId) throw new AppError("Teacher ID is required", 400);
  return _performClaim(groupId, {
    assigneeId: targetTeacherId,
    assignedById: adminId,
    isSelfAssigned: false,
    notify: true,
  });
};

const releaseGroup = async (groupId, userId, reason) => {
  const group = await dcsGroupRepository.findById(groupId);
  if (!group) throw new AppError("DCS group not found", 404);
  if (group.status !== "claimed") {
    throw new AppError("Cannot release a group that hasn't been claimed", 400);
  }
  if (
    group.assignedTeacher &&
    group.assignedTeacher._id.toString() !== String(userId)
  ) {
    throw new AppError("Only the assigned DCS can release this group", 403);
  }

  await withOptionalTransaction(async (session) => {
    await Duty.updateMany(
      { _id: { $in: group.duties } },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason || "Released by DCS",
      },
      session ? { session } : {}
    );

    await dcsGroupRepository.updateById(
      groupId,
      {
        assignedTeacher: null,
        status: "open",
        duties: [],
      },
      session
    );
  });

  return dcsGroupRepository.findById(groupId);
};

// ──────────────────────────────────────────────────────────────
// Per-room invigilator contacts (used by DCS Upcoming Duties)
// ──────────────────────────────────────────────────────────────

/**
 * For each ExamRoom in a DCS group, return the currently-assigned invigilator
 * (if any) with contact info. The DCS is the supervisor and needs to reach
 * the people working under them.
 */
const getRoomInvigilators = async (groupId) => {
  const group = await dcsGroupRepository.findById(groupId);
  if (!group) throw new AppError("DCS group not found", 404);

  const result = [];
  for (const examRoom of group.assignedRooms) {
    const duties = await Duty.find({
      examRoom: examRoom._id,
      status: "assigned",
    })
      .populate("teacher", "name email phone roles department designation");

    // The same examRoom can have RS + Invigilator + DCS duties — surface only
    // invigilators (the people physically watching this room). RS coverage is
    // visible elsewhere; DCS is the current user.
    const invigilators = duties
      .filter((d) => d.role === "invigilator")
      .map((d) => d.teacher)
      .filter(Boolean);

    result.push({
      examRoomId: examRoom._id,
      room: examRoom.room,
      departments: examRoom.departments,
      invigilators: invigilators.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        department: u.department || null,
        designation: u.designation || null,
      })),
    });
  }

  return {
    groupId: group._id,
    rooms: result,
  };
};

module.exports = {
  // Sizing helpers re-exported for tests / scripts
  calculateRequiredDCS,
  distributeClasses,
  // Lifecycle
  generateDCSGroupsForExamGroup,
  resolveStudentCount,
  // Read
  listGroups,
  getGroupById,
  getMyGroups,
  getRoomInvigilators,
  // Mutations
  claimGroup,
  adminClaimGroup,
  releaseGroup,
};
