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
const { emit, emitToMany } = require("../notification/notification.emitter");
const userService = require("../user/user.service");
const {
  assertTargetNotReached,
} = require("../duty-calculation/dutyCalculation.service");

const {
  calculateRequiredDCS,
  distributeClasses,
  planGroupLayout,
} = require("./dcsCalculation.utils");
const { roomDutyFromTemplate } = require("../duty/duty.factory");
const { compareRoomNumbers } = require("../../shared/utils/roomOrder");

/**
 * Tell CS that a DCS took or released a group themselves. Fire-and-forget: CS
 * awareness must never fail the teacher's own action.
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
    console.error(`[dcs] failed to notify CS (${type}):`, err.message);
  }
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

  // One query for every department's semester instead of a findOne per dept.
  const semesters = await Semester.find({
    department: { $in: depts.map((d) => d._id) },
    name: semName,
  });
  const countByDept = new Map();
  for (const sem of semesters) {
    countByDept.set(String(sem.department), sem.studentCount || 0);
  }

  const perDepartment = {};
  let total = 0;
  for (const dept of depts) {
    const count = countByDept.get(String(dept._id)) || 0;
    perDepartment[dept.code] = count;
    total += count;
  }
  return { total, perDepartment };
};

// ──────────────────────────────────────────────────────────────
// Group sizing (called from cie/see finalize and exam deletion)
// ──────────────────────────────────────────────────────────────

// Parks re-used groups above any real index while they're renumbered, so the
// unique { schedule, groupIndex } index never sees two at once.
const TEMP_INDEX_BASE = 100000;

/**
 * Size one schedule's DCS groups to the rooms and students it has NOW:
 * N = ceil(students / 300) across every department in the slot. Runs when a
 * schedule is created, when another department joins a shared SEE slot
 * (`cause: "join"`), and when one leaves it (`cause: "leave"`), so
 * 6 departments × 60 students in 12 rooms get 2 DCS whether they were created
 * together or one at a time.
 *
 * The layout itself is pure (`planGroupLayout`): held groups keep their rooms
 * and are topped up; nobody holding → laid out from scratch. This function
 * applies it in one transaction: a holder gets a duty for each added room and
 * one `duty_group_updated` (in-app, email, push) listing rooms added and
 * removed; a held group left with no rooms is released and its holder told.
 * Open groups are updated in place rather than recreated, so change requests
 * that point at them stay valid.
 */
const syncGroupsForSchedule = async (scheduleId, { cause } = {}) => {
  const schedule = await examScheduleRepository.findById(scheduleId);
  if (!schedule) return [];
  const examGroup = await examGroupRepository.findById(schedule.examGroup);
  if (!examGroup) return [];

  // Room-number order: deterministic, and group 1 owns the lowest-numbered
  // classrooms (matches the printed seating plan order).
  const rooms = (await examRoomRepository.findBySchedule(scheduleId)).sort((a, b) =>
    compareRoomNumbers(a.room?.roomNumber || "", b.room?.roomNumber || "")
  );
  const existing = await dcsGroupRepository.findRawBySchedule(scheduleId);
  const { total: totalStudents } = await resolveStudentCount(rooms, examGroup.semester);
  // Fall back to "1 DCS" when student data is missing but there are rooms to
  // staff — we never want a schedule with rooms and zero DCS slots.
  let required = calculateRequiredDCS(totalStudents);
  if (required === 0 && rooms.length > 0) required = 1;

  const { plan, emptied, reusable } = planGroupLayout({ rooms, existing, required });
  const roomById = new Map(rooms.map((r) => [String(r._id), r]));
  // Per-group student count is best-effort: total split by room count, since
  // exact per-room counts aren't stored anywhere on ExamRoom.
  const describe = (roomIds) => ({
    dcsRequired: plan.length,
    assignedRooms: roomIds,
    assignedDepartments: [
      ...new Set(
        roomIds.flatMap((id) => (roomById.get(String(id))?.departments || []).map((c) => String(c).toUpperCase()))
      ),
    ].sort(),
    assignedStudents: rooms.length ? Math.round((totalStudents * roomIds.length) / rooms.length) : 0,
  });
  const slot = {
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    examLabel: examGroup.examType,
    semester: examGroup.semester,
  };

  await withOptionalTransaction(async (session) => {
    // A held group whose every room was deleted: back to open, holder told.
    for (const g of emptied) {
      await dcsGroupRepository.updateIfStatus(
        g._id,
        "claimed",
        { assignedTeacher: null, status: "open", duties: [] },
        session
      );
      if (g.assignedTeacher) {
        await emit("duty_group_cancelled", {
          recipient: g.assignedTeacher,
          role: "dcs",
          data: { roleLabel: "DCS", roomCount: (g.assignedRooms || []).length, ...slot, cause: "dcsRoomsDeleted" },
          session,
        });
      }
      g.status = "open";
    }

    const openPlan = plan.filter((p) => !p.held);
    const reused = reusable.slice(0, openPlan.length);
    const surplus = reusable.slice(openPlan.length);
    if (surplus.length > 0) {
      await dcsGroupRepository.deleteOpenByIds(surplus.map((g) => g._id), session);
    }
    for (let i = 0; i < reused.length; i++) {
      await dcsGroupRepository.updateIfStatus(
        reused[i]._id,
        reused[i].status,
        { groupIndex: TEMP_INDEX_BASE + i },
        session
      );
    }

    for (const p of plan.filter((x) => x.held)) {
      await applyHeldGroup(p, { schedule, describe, slot, cause, session });
    }

    // Open groups: re-use existing docs (renumbered), insert the rest.
    const fresh = [];
    for (let i = 0; i < openPlan.length; i++) {
      const fields = {
        ...describe(openPlan[i].rooms),
        groupIndex: openPlan[i].groupIndex,
        assignedTeacher: null,
        status: "open",
        duties: [],
      };
      if (i < reused.length) {
        await dcsGroupRepository.updateIfStatus(reused[i]._id, reused[i].status, fields, session);
      } else {
        fresh.push({ ...fields, examGroup: schedule.examGroup, schedule: schedule._id });
      }
    }
    if (fresh.length > 0) await dcsGroupRepository.insertMany(fresh, session);
  });

  return dcsGroupRepository.findRawBySchedule(scheduleId);
};

/**
 * One held group of a sync plan: give the holder a duty for each added room,
 * drop duties on deleted rooms, save the group, and tell the holder what
 * changed (nothing changed → no notification).
 */
const applyHeldGroup = async (p, { schedule, describe, slot, cause, session }) => {
  const { doc } = p.held;
  const groupDuties = await Duty.find({ _id: { $in: doc.duties || [] } }, null, session ? { session } : {});
  const liveRoomIds = new Set(p.rooms.map(String));
  // Duties on rooms that no longer exist (cancelled by the deletion cascade).
  // They leave `duties` below, so a later sync won't re-report them.
  const removed = groupDuties
    .filter((d) => !liveRoomIds.has(String(d.examRoom)))
    .map((d) => d.room)
    .filter(Boolean);
  const template = groupDuties.find((d) => d.status === "assigned");

  const created = p.added.length
    ? await dutyRepository.createMany(
        p.added.map((examRoom) =>
          roomDutyFromTemplate({ schedule, examRoom, teacher: doc.assignedTeacher, role: "dcs", template })
        ),
        session
      )
    : [];
  const keptDuties = groupDuties
    .filter((d) => d.status === "assigned" && liveRoomIds.has(String(d.examRoom)))
    .map((d) => d._id);
  await dcsGroupRepository.updateIfStatus(
    doc._id,
    "claimed",
    { ...describe(p.rooms), duties: [...keptDuties, ...created.map((d) => d._id)] },
    session
  );

  const added = p.added.map((r) => r.room?.roomNumber).filter(Boolean);
  if (added.length === 0 && removed.length === 0) return;
  await emit("duty_group_updated", {
    recipient: doc.assignedTeacher,
    role: "dcs",
    refModel: "Duty",
    refId: keptDuties[0] || created[0]?._id || null,
    data: { roleLabel: "DCS", added, removed, roomCount: p.rooms.length, ...slot, cause },
    session,
  });
};

/**
 * Public entry point: called at exam-creation time, after ExamRooms have been
 * written. Sizes the DCS groups of every schedule the ExamGroup sits in —
 * including shared slots, which re-size to cover the new rooms too.
 */
const generateDCSGroupsForExamGroup = async (examGroupId) => {
  const examGroup = await examGroupRepository.findById(examGroupId);
  if (!examGroup) throw new AppError("Exam group not found", 404);

  const schedules = await examScheduleRepository.findByExamGroup(examGroupId);
  const allGroups = [];
  for (const schedule of schedules) {
    allGroups.push(...(await syncGroupsForSchedule(schedule._id)));
  }
  return allGroups;
};

// ──────────────────────────────────────────────────────────────
// Read APIs
// ──────────────────────────────────────────────────────────────

const listGroups = async (query = {}) => {
  const filter = {};
  if (query.examGroup) {
    // A department that joined a shared SEE slot doesn't own its DCS groups
    // (the slot's owner does), so match by the schedules the group sits in too.
    const schedules = await examScheduleRepository.findByExamGroup(query.examGroup);
    filter.$or = [
      { examGroup: query.examGroup },
      { schedule: { $in: schedules.map((s) => s._id) } },
    ];
  }
  if (query.schedule) filter.schedule = query.schedule;
  if (query.status) filter.status = query.status;
  // CS views a specific teacher's claimed groups (Manage Duties) by filtering
  // on the persisted assignee — backed by the { assignedTeacher, status } index.
  if (query.assignedTeacher) filter.assignedTeacher = query.assignedTeacher;
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
 * the same user for self-claim, or the CS admin for admin-claim).
 *
 * Exactly ONE notification fires per claim, never one per room: a
 * `duty_group_assigned` when CS assigned it (`notify: true`), or a
 * `duty_self_claimed` confirmation plus a CS awareness alert when the DCS
 * claimed it themselves.
 */
const _performClaim = async (
  groupId,
  { assigneeId, assignedById, isSelfAssigned, notify }
) => {
  const assignee = await validateDcsUser(assigneeId);

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
    // Take the group first, atomically: of several DCS claiming at once, only
    // one flips it open → claimed. The rest stop here, before writing a duty.
    const won = await dcsGroupRepository.claimIfOpen(groupId, assigneeId, session);
    if (!won) throw new AppError("This DCS group is already taken", 409);

    let duties;
    try {
      duties = await dutyRepository.createMany(
        group.assignedRooms.map((examRoom) => ({
          exam: null,
          examSchedule: group.schedule._id,
          examRoom: examRoom._id,
          teacher: assigneeId,
          role: "dcs",
          room: examRoom?.room?.roomNumber || "",
          roomRef: examRoom?.room?._id || null,
          date: group.schedule.date,
          startTime: group.schedule.startTime,
          endTime: group.schedule.endTime,
          assignedBy: assignedById,
          isSelfAssigned,
        })),
        session
      );
    } catch (err) {
      // No transaction (standalone Mongo) means no rollback — hand the group back.
      if (!session) {
        await dcsGroupRepository.updateById(
          groupId,
          { assignedTeacher: null, status: "open", duties: [] },
          null
        );
      }
      throw err;
    }

    const dutyIds = duties.map((d) => d._id);
    await dcsGroupRepository.updateById(groupId, { duties: dutyIds }, session);
    return dutyIds;
  });

  // ONE notification for the whole group — a DCS supervises the group as a
  // unit, so per-room alerts were just noise (5 rooms → 5 bells).
  const groupData = {
    roleLabel: "DCS",
    roomCount: createdIds.length,
    date: group.schedule.date,
    startTime: group.schedule.startTime,
    endTime: group.schedule.endTime,
    examLabel: group.examGroup?.examType,
    semester: group.examGroup?.semester,
  };

  if (notify) {
    emit("duty_group_assigned", {
      recipient: assigneeId,
      role: "dcs",
      refModel: "Duty",
      refId: createdIds[0] || null,
      data: groupData,
    });
  } else {
    // Self-claim. The DCS gets a confirmation to hold onto; CS is intentionally
    // NOT alerted on every self-claim (they can see the group in Manage Duties).
    emit("duty_self_claimed", {
      recipient: assigneeId,
      role: "dcs",
      refModel: "Duty",
      refId: createdIds[0] || null,
      data: groupData,
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
const adminClaimGroup = async (groupId, targetTeacherId, adminId) => {
  if (!targetTeacherId) throw new AppError("Teacher ID is required", 400);
  // CS can't assign a DCS group once the teacher has met their DCS target.
  await assertTargetNotReached(targetTeacherId, "dcs");
  return _performClaim(groupId, {
    assigneeId: targetTeacherId,
    assignedById: adminId,
    isSelfAssigned: false,
    notify: true,
  });
};

/**
 * Release a claimed DCS group back to `open`. `actor` ({ id, activeRole }) is
 * either the DCS holding it (a self-release, which alerts CS) or CS unassigning
 * them (which tells the teacher instead — CS doesn't need an alert about its own
 * action).
 */
const releaseGroup = async (groupId, actor, reason) => {
  const group = await dcsGroupRepository.findById(groupId);
  if (!group) throw new AppError("DCS group not found", 404);
  if (group.status !== "claimed") {
    throw new AppError("Cannot release a group that hasn't been claimed", 400);
  }
  const byCs = actor.activeRole === "cs";
  if (
    !byCs &&
    group.assignedTeacher &&
    group.assignedTeacher._id.toString() !== String(actor.id)
  ) {
    throw new AppError("Only the assigned DCS can release this group", 403);
  }

  await withOptionalTransaction(async (session) => {
    await Duty.updateMany(
      { _id: { $in: group.duties } },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason || (byCs ? "Unassigned by CS" : "Released by DCS"),
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

  if (byCs) {
    if (group.assignedTeacher) {
      emit("duty_group_cancelled", {
        recipient: group.assignedTeacher._id,
        role: "dcs",
        refModel: "Duty",
        refId: group.duties?.[0] || null,
        data: {
          roleLabel: "DCS",
          roomCount: group.duties?.length || 0,
          date: group.schedule?.date,
          startTime: group.schedule?.startTime,
          endTime: group.schedule?.endTime,
          reason: reason || null,
        },
      });
    }
  } else {
    // The DCS gets the same "it's off your schedule" confirmation an
    // invigilator gets for their own release — and their calendar a cancel.
    if (group.assignedTeacher) {
      emit("duty_group_cancelled", {
        recipient: group.assignedTeacher._id,
        role: "dcs",
        refModel: "Duty",
        refId: group.duties?.[0] || null,
        data: {
          roleLabel: "DCS",
          roomCount: group.duties?.length || 0,
          date: group.schedule?.date,
          startTime: group.schedule?.startTime,
          endTime: group.schedule?.endTime,
          selfReleased: true,
        },
      });
    }
    notifyCsOfTeacherAction("group_released", {
      refId: group.duties?.[0] || null,
      data: {
        teacherName: group.assignedTeacher?.name || "A teacher",
        roleLabel: "DCS",
        roomCount: group.duties?.length || 0,
        date: group.schedule?.date,
        reason: reason || null,
      },
    });
  }

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

  // One query for every room's invigilators instead of a find per room. The
  // same examRoom can have RS + Invigilator + DCS duties — scope to invigilators
  // (the people physically watching the room; RS/DCS are surfaced elsewhere).
  const roomIds = group.assignedRooms.map((er) => er._id);
  const duties = await Duty.find({
    examRoom: { $in: roomIds },
    role: "invigilator",
    status: "assigned",
  }).populate("teacher", "name email phone roles department designation");

  const invigilatorsByRoom = new Map();
  for (const d of duties) {
    if (!d.teacher) continue;
    const key = String(d.examRoom);
    if (!invigilatorsByRoom.has(key)) invigilatorsByRoom.set(key, []);
    invigilatorsByRoom.get(key).push(d.teacher);
  }

  const result = group.assignedRooms.map((examRoom) => ({
    examRoomId: examRoom._id,
    room: examRoom.room,
    departments: examRoom.departments,
    invigilators: (invigilatorsByRoom.get(String(examRoom._id)) || []).map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || null,
      department: u.department || null,
      designation: u.designation || null,
    })),
  }));

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
  syncGroupsForSchedule,
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
