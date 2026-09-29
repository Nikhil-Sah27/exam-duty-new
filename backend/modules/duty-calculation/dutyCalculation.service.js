const AppError = require("../../shared/utils/AppError");
const User = require("../auth/auth.model");
const Department = require("../department/department.model");
const Semester = require("../department/semester.model");
const Course = require("../department/course.model");
const Room = require("../infrastructure/infrastructure.model");
const ExamGroup = require("../exam/examGroup.model");
const Duty = require("../duty/duty.model");
const DCSGroup = require("../dcs/dcsGroup.model");
const examGroupRepo = require("../exam/examGroup.repository");

/**
 * Centralised duty-target calculation.
 *
 * Every derived number in the invigilator workload equation flows through
 * this service — semester → department → institution totals, eligible
 * invigilator count, per-teacher target, and per-teacher progress.
 *
 * All calculations run on demand against the current database state.  No
 * values are stored, so a course/student/teacher change is reflected on the
 * next read without any invalidation dance.  For low institutional scale
 * (few dozen semesters × few departments) that's cheap.
 *
 * Formula (from spec):
 *   Semester duties      = ceil((courses × students × examTypes) / avgRoomCap)
 *   Department duties    = Σ semester duties
 *   Institution duties   = Σ department duties
 *   Duty per invigilator = round(institution duties / eligible teachers)
 *
 * Eligibility: designation is *strictly* "Assistant Professor" or
 * "Associate Professor".  Every other designation (Professor, HOD, Principal,
 * Vice Principal, COE, Controller, non-teaching, …) is excluded, as are the
 * DCS/RS/CS roles which handle group-level supervision.
 */

const ELIGIBLE_DESIGNATIONS = ["Assistant Professor", "Associate Professor"];
const ASSISTANT_DESIGNATION = "Assistant Professor";
const ASSOCIATE_DESIGNATION = "Associate Professor";
// Associate profs carry 30% less than assistants (i.e. 70% of the base).
const ASSOCIATE_MULTIPLIER = 0.7;

// ---------- RS (Room Superintendent) duty constants ----------
//
// RS is a *group* role: one RS supervises up to 5 rooms in a block. So the
// total RS workload is the institution invigilator workload divided by 5, and
// it's shared only by Professors + Associate Professors who carry the RS role.
// Within that pool the same 70/30 split applies, but the *base* role here is
// Professor (x) with Associate Professors at 0.7x.
const RS_ELIGIBLE_DESIGNATIONS = ["Professor", "Associate Professor"];
const PROFESSOR_DESIGNATION = "Professor";
// Rooms supervised per RS group — the invigilator→RS divisor.
const RS_ROOMS_PER_GROUP = 5;

// ---------- DCS (Deputy Chief Superintendent) duty constants ----------
//
// DCS is a group role handled only by HOD/Dean. Per the spec, each semester's
// DCS duties = (courses × students × examTypes) / 300 (one DCS ≈ 300 students),
// summed across semesters and departments, then split evenly across the
// HOD/Dean pool (no 70/30 weighting — a single designation).
const DCS_ELIGIBLE_DESIGNATIONS = ["HOD/Dean"];
const DCS_STUDENTS_PER_DUTY = 300;

// ---------- Low-level primitives ----------

/**
 * Average capacity across every active room in the institution.  Returns 0
 * when there are no rooms so downstream callers can short-circuit safely
 * instead of dividing by zero.
 */
const getAverageClassroomCapacity = async () => {
  const [result] = await Room.aggregate([
    { $match: { isActive: true, capacity: { $gt: 0 } } },
    { $group: { _id: null, avg: { $avg: "$capacity" } } },
  ]);
  return result?.avg || 0;
};

/**
 * Number of distinct examTypes planned for a given semester number
 * (1–8).  ExamGroup carries a numeric semester field, so we can query it
 * institution-wide — the same semester number in different departments
 * shares an ExamGroup by design in this codebase.
 */
const getExamTypeCountForSemester = async (semesterNumber) => {
  if (!Number.isFinite(semesterNumber)) return 0;
  const examTypes = await ExamGroup.distinct("examType", {
    semester: semesterNumber,
  });
  return examTypes.length;
};

const countEligibleTeachers = () =>
  User.countDocuments({
    roles: "invigilator",
    isActive: true,
    designation: { $in: ELIGIBLE_DESIGNATIONS },
  });

/**
 * Return the eligible teacher pool split by designation. Sorted by _id so
 * the "extra duty" tie-break for assistants (see distribution below) is
 * deterministic across refreshes — a given teacher's target doesn't flip
 * on every render.
 */
const getEligibleTeacherPool = async () => {
  const teachers = await User.find({
    roles: "invigilator",
    isActive: true,
    designation: { $in: ELIGIBLE_DESIGNATIONS },
  })
    .select("_id designation")
    .sort({ _id: 1 });

  const assistants = [];
  const associates = [];
  for (const t of teachers) {
    const d = (t.designation || "").trim();
    if (d === ASSISTANT_DESIGNATION) assistants.push(t._id.toString());
    else if (d === ASSOCIATE_DESIGNATION) associates.push(t._id.toString());
  }
  return { assistants, associates };
};

/**
 * RS-eligible teacher pool: Professors and Associate Professors who hold the
 * `rs` role. Sorted by _id (same determinism guarantee as the invigilator
 * pool) so the remainder tie-break is stable across refreshes.
 */
const getRsEligibleTeacherPool = async () => {
  const teachers = await User.find({
    roles: "rs",
    isActive: true,
    designation: { $in: RS_ELIGIBLE_DESIGNATIONS },
  })
    .select("_id designation")
    .sort({ _id: 1 });

  const professors = [];
  const associates = [];
  for (const t of teachers) {
    const d = (t.designation || "").trim();
    if (d === PROFESSOR_DESIGNATION) professors.push(t._id.toString());
    else if (d === ASSOCIATE_DESIGNATION) associates.push(t._id.toString());
  }
  return { professors, associates };
};

// ---------- Step 1: per-semester ----------

const calculateSemesterDuties = async (semesterId, options = {}) => {
  const semester = options.semesterDoc || (await Semester.findById(semesterId));
  if (!semester) throw new AppError("Semester not found", 404);

  const avgCapacity =
    options.avgCapacity ?? (await getAverageClassroomCapacity());

  const [courseCount, examTypeCount] = await Promise.all([
    Course.countDocuments({ semester: semester._id }),
    getExamTypeCountForSemester(parseInt(semester.name, 10)),
  ]);

  const students = semester.studentCount || 0;

  let duties = 0;
  if (avgCapacity > 0 && courseCount > 0 && students > 0 && examTypeCount > 0) {
    duties = Math.ceil((courseCount * students * examTypeCount) / avgCapacity);
  }

  return {
    semesterId: semester._id,
    semesterName: semester.name,
    department: semester.department,
    duties,
    breakdown: {
      courses: courseCount,
      students,
      examTypes: examTypeCount,
      avgClassroomCapacity: avgCapacity,
    },
  };
};

// ---------- Step 2: per-department ----------

const calculateDepartmentDuties = async (departmentId, options = {}) => {
  const department =
    options.departmentDoc || (await Department.findById(departmentId));
  if (!department) throw new AppError("Department not found", 404);

  const semesters = await Semester.find({ department: department._id }).sort({
    name: 1,
  });

  const avgCapacity =
    options.avgCapacity ?? (await getAverageClassroomCapacity());

  const semesterResults = await Promise.all(
    semesters.map((s) =>
      calculateSemesterDuties(s._id, { semesterDoc: s, avgCapacity })
    )
  );

  const total = semesterResults.reduce((sum, s) => sum + s.duties, 0);

  return {
    departmentId: department._id,
    code: department.code,
    name: department.name,
    total,
    semesters: semesterResults,
  };
};

// ---------- Step 3: institution ----------

const calculateInstitutionDuty = async () => {
  const [departments, avgCapacity] = await Promise.all([
    Department.find({ isActive: true }),
    getAverageClassroomCapacity(),
  ]);

  const departmentResults = await Promise.all(
    departments.map((d) =>
      calculateDepartmentDuties(d._id, { departmentDoc: d, avgCapacity })
    )
  );

  const total = departmentResults.reduce((sum, d) => sum + d.total, 0);

  return {
    total,
    avgClassroomCapacity: avgCapacity,
    departments: departmentResults,
  };
};

// ---------- Step 4: per-invigilator target ----------

/**
 * Distribute institution-wide duties across the eligible teacher pool with a
 * 70/30 weighting: Associate Professors carry 70% of what an Assistant
 * Professor does (Assistant = x, Associate = 0.7x). We solve for the largest
 * integer x that keeps `A*x + B*round(0.7x) <= total`, then hand any remaining
 * duties (leftover from integer rounding) to Assistant Professors one at a
 * time — the "extras go to assistants randomly" rule. Determinism: we sort
 * assistants by _id, so the same set of teachers picks up the +1 each time
 * the calc runs, keeping the dashboard number stable across refreshes.
 */
const distributeDuties = (totalDuties, pool) => {
  const A = pool.assistants.length;
  const B = pool.associates.length;

  if (A + B === 0 || totalDuties <= 0) {
    return {
      assistantBase: 0,
      associateBase: 0,
      assistantExtras: new Map(),
      distributedTotal: 0,
    };
  }

  const weighted = A + ASSOCIATE_MULTIPLIER * B;
  const assistantBase = Math.floor(totalDuties / weighted);
  const associateBase = Math.round(ASSOCIATE_MULTIPLIER * assistantBase);
  const distributedBase = A * assistantBase + B * associateBase;
  const remainder = Math.max(0, totalDuties - distributedBase);

  // Every assistant absorbs floor(remainder/A) extras; the first
  // (remainder mod A) assistants take one more so the total lands
  // exactly on the institution figure. Sort came from
  // getEligibleTeacherPool (_id ascending) so the same teachers pick up
  // the extra between renders — the "random" is stable-per-teacher.
  const assistantExtras = new Map();
  if (A > 0 && remainder > 0) {
    const baseExtra = Math.floor(remainder / A);
    const overflow = remainder % A;
    pool.assistants.forEach((id, idx) => {
      const extra = baseExtra + (idx < overflow ? 1 : 0);
      if (extra > 0) assistantExtras.set(id, extra);
    });
  }

  let extrasDistributed = 0;
  for (const n of assistantExtras.values()) extrasDistributed += n;

  return {
    assistantBase,
    associateBase,
    assistantExtras,
    distributedTotal: distributedBase + extrasDistributed,
  };
};

const calculateDutyPerInvigilator = async (options = {}) => {
  const institution = options.institution || (await calculateInstitutionDuty());
  const pool = options.pool || (await getEligibleTeacherPool());
  const eligibleCount = pool.assistants.length + pool.associates.length;

  const distribution = distributeDuties(institution.total, pool);

  return {
    // Kept for legacy consumers — average target across the whole eligible pool.
    target: eligibleCount > 0 ? Math.round(institution.total / eligibleCount) : 0,
    totalDuties: institution.total,
    eligibleTeachers: eligibleCount,
    assistantCount: pool.assistants.length,
    associateCount: pool.associates.length,
    assistantBase: distribution.assistantBase,
    associateBase: distribution.associateBase,
    assistantExtras: distribution.assistantExtras,
    avgClassroomCapacity: institution.avgClassroomCapacity,
  };
};

// ---------- Completed-duty count ----------

/**
 * Any duty whose end has already passed is treated as completed — even if
 * the status field still says "assigned", because there's no background
 * job flipping the flag.  This means "Completed" grows automatically once
 * an exam's end time is in the past.
 */
/**
 * A duty is "completed" once its end has passed (even if the status field still
 * says "assigned" — there's no job flipping it). Shared by the room-level and
 * group-level counters below.
 */
const completedDutyMatch = () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const nowHhMm = `${hh}:${mm}`;

  return {
    $or: [
      { status: "completed" },
      {
        status: "assigned",
        $or: [
          { date: { $lt: startOfToday } },
          {
            date: { $gte: startOfToday, $lt: endOfToday },
            endTime: { $lt: nowHhMm },
          },
        ],
      },
    ],
  };
};

const countCompletedDutiesForTeacher = async (teacherId) => {
  return Duty.countDocuments({
    teacher: teacherId,
    // Role-scoped so a teacher's RS/DCS room duties never inflate their
    // invigilator completed count (matches the role-scoped active counter).
    role: "invigilator",
    ...completedDutyMatch(),
  });
};

/**
 * Count a teacher's *active* (non-cancelled) invigilator duties — i.e. every
 * duty that counts toward "target reached": upcoming + ongoing + completed.
 * Unlike the completed counter this is role-scoped, since target-reached
 * enforcement is per-role.
 */
const countActiveDutiesForTeacher = (teacherId) =>
  Duty.countDocuments({
    teacher: teacherId,
    role: "invigilator",
    status: { $ne: "cancelled" },
  });

/**
 * Count a teacher's RS **groups** (not rooms) matching `dutyMatch`. RS claims
 * whole room groups (≤5 rooms per schedule + building), stored as one Duty per
 * room. To match the group cards on the dashboard — and the group-unit target
 * (total RS = invigilator ÷ 5) — we partition rs duties exactly like the UI's
 * `groupRSDutiesIntoUpcomingGroups` (schedule + date + slot + building) and
 * chunk each partition by 5. `dutyMatch` selects which duties count (completed
 * vs. all active).
 */
const countRsGroupsForTeacher = async (teacherId, dutyMatch) => {
  const duties = await Duty.find({
    teacher: teacherId,
    role: "rs",
    ...dutyMatch,
  })
    .select("examSchedule roomRef date startTime endTime _id")
    .populate({ path: "roomRef", select: "building" });

  const partitions = new Map();
  for (const d of duties) {
    const scheduleId = d.examSchedule?.toString();
    const buildingId = d.roomRef?.building?.toString();
    const dateKey = new Date(d.date).toISOString().slice(0, 10);
    // Legacy duties missing schedule/building can't be grouped — count each as
    // its own group so nothing is silently dropped.
    const key =
      scheduleId && buildingId
        ? [scheduleId, dateKey, d.startTime, d.endTime, buildingId].join("|")
        : `legacy:${d._id}`;
    partitions.set(key, (partitions.get(key) || 0) + 1);
  }

  let groups = 0;
  for (const roomCount of partitions.values()) {
    groups += Math.ceil(roomCount / RS_ROOMS_PER_GROUP);
  }
  return groups;
};

/** Completed RS groups — schedule already ended. Powers the progress circle. */
const countCompletedRsGroupsForTeacher = (teacherId) =>
  countRsGroupsForTeacher(teacherId, completedDutyMatch());

/** Active (non-cancelled) RS groups — upcoming + ongoing + completed. */
const countActiveRsGroupsForTeacher = (teacherId) =>
  countRsGroupsForTeacher(teacherId, { status: { $ne: "cancelled" } });

// ---------- Per-teacher progress ----------

const isEligibleDesignation = (designation) =>
  ELIGIBLE_DESIGNATIONS.includes((designation || "").trim());

/**
 * The teacher-specific target depends on their designation:
 *   Associate Professor → `associateBase`
 *   Assistant Professor → `assistantBase` (+ 1 if they were picked to
 *                           absorb a remainder duty)
 *   Anything else       → 0 (not eligible)
 */
const resolveTeacherTarget = (teacher, perInvigilator) => {
  const designation = (teacher.designation || "").trim();
  if (designation === ASSOCIATE_DESIGNATION) return perInvigilator.associateBase;
  if (designation === ASSISTANT_DESIGNATION) {
    const extra = perInvigilator.assistantExtras.get(teacher._id.toString()) || 0;
    return perInvigilator.assistantBase + extra;
  }
  return 0;
};

const calculateTeacherProgress = async (teacherId, options = {}) => {
  const teacher = await User.findById(teacherId);
  if (!teacher) throw new AppError("Teacher not found", 404);

  const perInvigilator =
    options.perInvigilator || (await calculateDutyPerInvigilator());

  const teacherRoles = teacher.roles || [];
  const eligible =
    teacherRoles.includes("invigilator") && isEligibleDesignation(teacher.designation);

  const target = eligible ? resolveTeacherTarget(teacher, perInvigilator) : 0;
  const completed = await countCompletedDutiesForTeacher(teacherId);
  // `assigned` counts everything that occupies a target slot (upcoming +
  // ongoing + completed); `reached` gates CS assignment once it hits target.
  const assigned = await countActiveDutiesForTeacher(teacherId);
  const reached = target > 0 && assigned >= target;
  const remaining = Math.max(0, target - completed);
  const percentage =
    target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return {
    teacherId: teacher._id,
    name: teacher.name,
    email: teacher.email,
    department: teacher.department,
    designation: teacher.designation,
    role: "invigilator",
    roles: teacherRoles,
    eligible,
    target,
    completed,
    assigned,
    reached,
    remaining,
    percentage,
    breakdown: {
      totalDuties: perInvigilator.totalDuties,
      eligibleTeachers: perInvigilator.eligibleTeachers,
      assistantCount: perInvigilator.assistantCount,
      associateCount: perInvigilator.associateCount,
      assistantBase: perInvigilator.assistantBase,
      associateBase: perInvigilator.associateBase,
      avgClassroomCapacity: perInvigilator.avgClassroomCapacity,
    },
  };
};

// ---------- RS (Room Superintendent) target + progress ----------

/**
 * Institution-wide RS duty target with the same weighted split as invigilators,
 * but the base role is Professor (x) and Associate Professors carry 0.7x.
 *
 *   Total RS duties   = round(total invigilator duties / RS_ROOMS_PER_GROUP)
 *   Per-teacher split = distributeDuties() with Professors in the base slot
 *
 * We reuse `distributeDuties` by mapping Professors onto its `assistants`
 * (base) slot and Associate Professors onto its `associates` (0.7x) slot —
 * identical maths, different roles.
 */
const calculateRsDutyPerTeacher = async (options = {}) => {
  const institution = options.institution || (await calculateInstitutionDuty());
  const pool = options.pool || (await getRsEligibleTeacherPool());
  const eligibleCount = pool.professors.length + pool.associates.length;

  const totalRsDuties = Math.round(institution.total / RS_ROOMS_PER_GROUP);

  const distribution = distributeDuties(totalRsDuties, {
    assistants: pool.professors, // base group (x)
    associates: pool.associates, // 0.7x
  });

  return {
    // Flat average across the eligible pool — kept for parity with the
    // invigilator payload's `target` field.
    target: eligibleCount > 0 ? Math.round(totalRsDuties / eligibleCount) : 0,
    totalDuties: totalRsDuties,
    totalInvigilatorDuties: institution.total,
    eligibleTeachers: eligibleCount,
    professorCount: pool.professors.length,
    associateCount: pool.associates.length,
    professorBase: distribution.assistantBase,
    associateBase: distribution.associateBase,
    professorExtras: distribution.assistantExtras,
    avgClassroomCapacity: institution.avgClassroomCapacity,
  };
};

const isRsEligibleDesignation = (designation) =>
  RS_ELIGIBLE_DESIGNATIONS.includes((designation || "").trim());

/**
 * Per-teacher RS target:
 *   Professor          → professorBase (+1 if picked to absorb a remainder)
 *   Associate Professor → associateBase
 *   Anything else      → 0 (not RS-eligible)
 */
const resolveRsTeacherTarget = (teacher, perRs) => {
  const designation = (teacher.designation || "").trim();
  if (designation === ASSOCIATE_DESIGNATION) return perRs.associateBase;
  if (designation === PROFESSOR_DESIGNATION) {
    const extra = perRs.professorExtras.get(teacher._id.toString()) || 0;
    return perRs.professorBase + extra;
  }
  return 0;
};

const calculateRsTeacherProgress = async (teacherId, options = {}) => {
  const teacher = await User.findById(teacherId);
  if (!teacher) throw new AppError("Teacher not found", 404);

  const perRs = options.perRs || (await calculateRsDutyPerTeacher());

  const teacherRoles = teacher.roles || [];
  const eligible =
    teacherRoles.includes("rs") && isRsEligibleDesignation(teacher.designation);

  const target = eligible ? resolveRsTeacherTarget(teacher, perRs) : 0;
  // RS is a group role — count completed groups, not individual rooms, so the
  // circle matches the group cards and the group-unit target.
  const completed = await countCompletedRsGroupsForTeacher(teacherId);
  // Active groups (upcoming + ongoing + completed) drive target-reached.
  const assigned = await countActiveRsGroupsForTeacher(teacherId);
  const reached = target > 0 && assigned >= target;
  const remaining = Math.max(0, target - completed);
  const percentage =
    target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return {
    teacherId: teacher._id,
    name: teacher.name,
    email: teacher.email,
    department: teacher.department,
    designation: teacher.designation,
    role: "rs",
    roles: teacherRoles,
    eligible,
    target,
    completed,
    assigned,
    reached,
    remaining,
    percentage,
    breakdown: {
      totalDuties: perRs.totalDuties,
      totalInvigilatorDuties: perRs.totalInvigilatorDuties,
      eligibleTeachers: perRs.eligibleTeachers,
      professorCount: perRs.professorCount,
      associateCount: perRs.associateCount,
      professorBase: perRs.professorBase,
      associateBase: perRs.associateBase,
      avgClassroomCapacity: perRs.avgClassroomCapacity,
    },
  };
};

// ---------- DCS (Deputy Chief Superintendent) target + progress ----------

/**
 * Institution-wide DCS duty total. Reuses the invigilator institution walk —
 * every semester breakdown already carries (courses, students, examTypes) — and
 * re-divides by 300 (the DCS-per-student divisor) instead of the average room
 * capacity. Ceil per semester, same as the invigilator engine.
 *
 *   Semester DCS duties = ceil((courses × students × examTypes) / 300)
 *   Total               = Σ over every semester of every active department
 */
const calculateDcsInstitutionDuty = async (options = {}) => {
  const institution = options.institution || (await calculateInstitutionDuty());

  let total = 0;
  for (const dept of institution.departments) {
    for (const sem of dept.semesters) {
      const b = sem.breakdown || {};
      if (b.courses > 0 && b.students > 0 && b.examTypes > 0) {
        total += Math.ceil(
          (b.courses * b.students * b.examTypes) / DCS_STUDENTS_PER_DUTY
        );
      }
    }
  }

  return { total, avgClassroomCapacity: institution.avgClassroomCapacity };
};

const countDcsEligibleTeachers = () =>
  User.countDocuments({
    roles: "dcs",
    isActive: true,
    designation: { $in: DCS_ELIGIBLE_DESIGNATIONS },
  });

/**
 * Flat per-DCS target: total DCS duties split evenly across the HOD/Dean pool.
 * No weighting — DCS is a single designation.
 */
const calculateDcsDutyPerTeacher = async (options = {}) => {
  const dcsInstitution =
    options.dcsInstitution || (await calculateDcsInstitutionDuty(options));
  const eligibleCount =
    options.eligibleCount ?? (await countDcsEligibleTeachers());

  return {
    target:
      eligibleCount > 0 ? Math.round(dcsInstitution.total / eligibleCount) : 0,
    totalDuties: dcsInstitution.total,
    eligibleTeachers: eligibleCount,
    avgClassroomCapacity: dcsInstitution.avgClassroomCapacity,
  };
};

const isDcsEligibleDesignation = (designation) =>
  DCS_ELIGIBLE_DESIGNATIONS.includes((designation || "").trim());

/** True once a DCS group's schedule has ended (mirrors the claim lifecycle gate). */
const scheduleHasEnded = (schedule) => {
  if (!schedule?.date) return false;
  const now = new Date();
  const day = new Date(schedule.date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) return true;
  if (day.getTime() === today.getTime()) {
    const [eh, em] = (schedule.endTime || "").split(":").map(Number);
    if (Number.isFinite(eh) && Number.isFinite(em)) {
      const endMin = eh * 60 + em;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return nowMin >= endMin;
    }
  }
  return false;
};

/**
 * Completed DCS groups for a teacher: claimed groups whose schedule has ended.
 * DCS is a group role and `DCSGroup` is persisted, so we count groups directly
 * (no room-chunking needed, unlike RS) — the circle matches the group cards.
 */
const countCompletedDcsGroupsForTeacher = async (teacherId) => {
  const groups = await DCSGroup.find({
    assignedTeacher: teacherId,
    status: "claimed",
  }).populate({ path: "schedule", select: "date endTime" });

  return groups.filter((g) => scheduleHasEnded(g.schedule)).length;
};

/**
 * All DCS groups a teacher currently holds (upcoming + ongoing + completed) —
 * every claimed group counts toward the target, whether or not it has ended.
 */
const countActiveDcsGroupsForTeacher = (teacherId) =>
  DCSGroup.countDocuments({ assignedTeacher: teacherId, status: "claimed" });

const calculateDcsTeacherProgress = async (teacherId, options = {}) => {
  const teacher = await User.findById(teacherId);
  if (!teacher) throw new AppError("Teacher not found", 404);

  const perDcs = options.perDcs || (await calculateDcsDutyPerTeacher());

  const teacherRoles = teacher.roles || [];
  const eligible =
    teacherRoles.includes("dcs") && isDcsEligibleDesignation(teacher.designation);

  const target = eligible ? perDcs.target : 0;
  const completed = await countCompletedDcsGroupsForTeacher(teacherId);
  // All claimed groups (upcoming + ongoing + completed) drive target-reached.
  const assigned = await countActiveDcsGroupsForTeacher(teacherId);
  const reached = target > 0 && assigned >= target;
  const remaining = Math.max(0, target - completed);
  const percentage =
    target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return {
    teacherId: teacher._id,
    name: teacher.name,
    email: teacher.email,
    department: teacher.department,
    designation: teacher.designation,
    role: "dcs",
    roles: teacherRoles,
    eligible,
    target,
    completed,
    assigned,
    reached,
    remaining,
    percentage,
    breakdown: {
      totalDuties: perDcs.totalDuties,
      eligibleTeachers: perDcs.eligibleTeachers,
      avgClassroomCapacity: perDcs.avgClassroomCapacity,
    },
  };
};

// ---------- Target-reached guard (CS assignment enforcement) ----------

const ROLE_LABEL = { invigilator: "invigilator", rs: "RS", dcs: "DCS" };

/**
 * Compute a teacher's role-specific progress. Single lookup used by both the
 * per-role progress endpoints and the assignment guard, so "reached" is defined
 * in exactly one place.
 */
const getTeacherProgressForRole = (teacherId, role) => {
  if (role === "rs") return calculateRsTeacherProgress(teacherId);
  if (role === "dcs") return calculateDcsTeacherProgress(teacherId);
  return calculateTeacherProgress(teacherId);
};

/**
 * Throw a 409 when the teacher has already met their target for this role, so
 * CS admin-assign paths can't push a teacher past their computed duty load.
 * Ineligible teachers (target 0) are never blocked.
 */
const assertTargetNotReached = async (teacherId, role) => {
  const progress = await getTeacherProgressForRole(teacherId, role);
  if (progress.reached) {
    const label = ROLE_LABEL[role] || role;
    throw new AppError(
      `${progress.name} has already completed their ${label} duty target (${progress.target}). No further duties can be assigned.`,
      409,
    );
  }
  return progress;
};

// ---------- Cohort view (admin analytics) ----------

/**
 * The single duty role a teacher is measured against in the cohort view when no
 * role filter is applied — derived from designation so each teacher maps to one
 * row: HOD/Dean → DCS, Professor → RS, Assistant/Associate Professor →
 * invigilator (their base duty; Associate Professors also do RS, which surfaces
 * when the RS role is explicitly filtered).
 */
const primaryDutyRoleForDesignation = (designation) => {
  const d = (designation || "").trim();
  if (isDcsEligibleDesignation(d)) return "dcs";
  if (d === PROFESSOR_DESIGNATION) return "rs";
  if (d === ASSISTANT_DESIGNATION || d === ASSOCIATE_DESIGNATION) {
    return "invigilator";
  }
  return null;
};

/**
 * Cohort workload table. Role-aware: a `role` filter narrows the roster to
 * teachers holding that role AND measures every row against that role's target /
 * completed / remaining. With no role filter each teacher is measured against
 * their own primary duty role (see `primaryDutyRoleForDesignation`), so RS and
 * DCS staff show their real group-based numbers instead of empty invigilator
 * rows. CS accounts and non-teaching ("Other") designations are always excluded.
 */
const calculateAllTeachersProgress = async ({ role, department } = {}) => {
  const filter = { isActive: true };
  // CS is a pure admin role with no invigilation duties, so CS-only accounts
  // never belong in the workload cohort. A specific role filter already excludes
  // them (they don't hold that role); otherwise drop them explicitly.
  if (role) filter.roles = role;
  else filter.roles = { $ne: "cs" };
  if (department) filter.department = department;
  // "Other" (and missing) designations are non-teaching accounts with no duty
  // target — keep them out of the workload report entirely.
  filter.designation = { $nin: ["Other", null] };

  // Precompute each role's distribution once and reuse it for every row, rather
  // than recomputing inside every per-teacher call.
  const [teachers, perInvigilator, perRs, perDcs] = await Promise.all([
    User.find(filter).sort({ name: 1 }),
    calculateDutyPerInvigilator(),
    calculateRsDutyPerTeacher(),
    calculateDcsDutyPerTeacher(),
  ]);

  const progressForRole = (teacherId, r) => {
    if (r === "rs") return calculateRsTeacherProgress(teacherId, { perRs });
    if (r === "dcs") return calculateDcsTeacherProgress(teacherId, { perDcs });
    return calculateTeacherProgress(teacherId, { perInvigilator });
  };

  // Which role(s) each teacher is measured against. A specific filter pins the
  // whole cohort to that one role; otherwise a teacher gets one row per duty
  // role they actually hold — so an Associate Professor (invigilator + RS) shows
  // both workloads, each with its own target/completed/remaining.
  const ROLE_ORDER = { invigilator: 0, rs: 1, dcs: 2 };
  const rolesForTeacher = (teacher) => {
    if (role) return [role];
    const held = (teacher.roles || []).filter((r) => r in ROLE_ORDER);
    const roles = held.length
      ? held
      : [primaryDutyRoleForDesignation(teacher.designation)].filter(Boolean);
    return roles.sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
  };

  const rowGroups = await Promise.all(
    teachers.map((t) =>
      Promise.all(
        rolesForTeacher(t).map((r) => progressForRole(t._id, r).catch(() => null))
      )
    )
  );

  const { assistantExtras, ...publicPerInvigilator } = perInvigilator;
  return {
    perInvigilator: publicPerInvigilator,
    teachers: rowGroups.flat().filter(Boolean),
  };
};

// ---------- Recalculate-all (dev/debug endpoint) ----------

/**
 * Doesn't mutate anything — recomputes every layer from scratch and returns
 * the full snapshot.  Useful for CS analytics and for verifying that
 * everything is dynamic (no stale cache).
 */
const recalculateAll = async () => {
  const institution = await calculateInstitutionDuty();
  const pool = await getEligibleTeacherPool();
  const perInvigilator = await calculateDutyPerInvigilator({
    institution,
    pool,
  });
  // Strip the private lookup set before handing back to controllers.
  const { assistantExtras, ...publicPerInvigilator } = perInvigilator;
  return {
    institution,
    perInvigilator: publicPerInvigilator,
  };
};

module.exports = {
  ELIGIBLE_DESIGNATIONS,
  getAverageClassroomCapacity,
  getExamTypeCountForSemester,
  countEligibleTeachers,
  isEligibleDesignation,
  calculateSemesterDuties,
  calculateDepartmentDuties,
  calculateInstitutionDuty,
  calculateDutyPerInvigilator,
  countCompletedDutiesForTeacher,
  countActiveDutiesForTeacher,
  calculateTeacherProgress,
  calculateAllTeachersProgress,
  recalculateAll,
  // Target-reached guard (CS assignment enforcement)
  getTeacherProgressForRole,
  assertTargetNotReached,
  // RS (Room Superintendent)
  RS_ELIGIBLE_DESIGNATIONS,
  getRsEligibleTeacherPool,
  calculateRsDutyPerTeacher,
  calculateRsTeacherProgress,
  countCompletedRsGroupsForTeacher,
  countActiveRsGroupsForTeacher,
  // DCS (Deputy Chief Superintendent)
  DCS_ELIGIBLE_DESIGNATIONS,
  calculateDcsInstitutionDuty,
  countDcsEligibleTeachers,
  calculateDcsDutyPerTeacher,
  calculateDcsTeacherProgress,
  countCompletedDcsGroupsForTeacher,
  countActiveDcsGroupsForTeacher,
};
