/**
 * Duty reminders, confirmation nudges and select-your-duty nudges
 * (REMINDERS_PLAN.md §A, §C).
 *
 * Everything here is per duty UNIT (duty/duty.unit.js) — a 5-room RS group is
 * reminded once, not five times — and deduped with `emitIfAbsent`, so the sweeps
 * can run as often as they like (and survive nodemon restarts) without ever
 * sending anything twice.
 */
const Duty = require("../duty/duty.model");
const ExamGroup = require("../exam/examGroup.model");
const ExamSchedule = require("../exam/examSchedule.model");
const ExamRoom = require("../exam/examRoom.model");
const DCSGroup = require("../dcs/dcsGroup.model");
const { emitIfAbsent } = require("./notification.emitter");
const userService = require("../user/user.service");
const { groupIntoUnits, unitKey, idOf, locationFor } = require("../duty/duty.unit");
const { buildRoomLabel, buildExamLabel } = require("../exam-cleanup/utils/examCleanupUtils");
const { localToUtc } = require("../../shared/utils/datetime");
const { calculateAllTeachersProgress } = require("../duty-calculation/dutyCalculation.service");

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Longest lead first. A stage is sent inside [start - lead, start - nextLead):
// once the next stage's moment has arrived, the earlier one is stale.
const STAGES = [
  { id: "3d", lead: 3 * DAY },
  { id: "1d", lead: 1 * DAY },
  { id: "30m", lead: 30 * MIN },
];

const CONFIRM_NUDGE_AFTER = 24 * HOUR; // unconfirmed this long after assignment → nudge
const CS_ALERT_WITHIN = 1 * DAY; // unconfirmed this close to the duty → tell CS
const CS_ALERT_GRACE = 6 * HOUR; // …but give a just-assigned teacher a chance first
const SELECT_STAGES = [
  { id: "7d", within: 7 * DAY },
  { id: "3d", within: 3 * DAY },
];

const ROLE_SHORT = { invigilator: "Invigilator", rs: "RS", dcs: "DCS" };

const utcDayStart = (offsetDays) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
};

/** Live units starting within the next few days, with their timing facts. */
const upcomingUnits = async (now) => {
  const duties = await Duty.find({
    status: "assigned",
    date: { $gte: utcDayStart(-1), $lt: utcDayStart(5) },
  })
    .populate("teacher", "name")
    .populate({ path: "examSchedule", select: "date startTime endTime examGroup", populate: { path: "examGroup", select: "examType semester" } })
    .populate({ path: "examRoom", select: "room", populate: { path: "room", select: "roomNumber building", populate: { path: "building", select: "name" } } });

  const units = [];
  for (const list of groupIntoUnits(duties).values()) {
    const first = list[0];
    if (!first.teacher) continue;
    const date = first.examSchedule?.date || first.date;
    const startTime = first.examSchedule?.startTime || first.startTime;
    const endTime = first.examSchedule?.endTime || first.endTime;
    const start = localToUtc(date, startTime);
    if (start <= now) continue;
    // "Main Block — 201, 202, 203" — the same wording the calendar invite uses.
    const room = list.length === 1 ? buildRoomLabel(first) : locationFor(list);
    const examGroup = first.examSchedule?.examGroup;
    units.push({
      teacherId: idOf(first.teacher),
      teacherName: first.teacher.name,
      role: first.role,
      key: unitKey(first),
      dutyId: idOf(first._id),
      start,
      assignedAt: new Date(Math.min(...list.map((d) => d.createdAt?.getTime() || now.getTime()))),
      unconfirmed: list.some((d) => !d.confirmedAt),
      data: {
        room,
        date,
        startTime,
        endTime,
        roleLabel: ROLE_SHORT[first.role] || first.role,
        roomCount: first.role === "invigilator" ? undefined : list.length,
        examLabel: buildExamLabel({ examGroup, exam: first.exam }),
        semester: examGroup?.semester ?? null,
      },
    });
  }
  return units;
};

/**
 * Timed reminders, confirmation nudges and the CS escalation. Cheap enough to
 * run every few minutes — which the 30-minute reminder needs.
 */
const runReminderTick = async () => {
  const now = new Date();
  const tally = { reminders: 0, nudges: 0, csAlerts: 0 };
  const units = await upcomingUnits(now);
  let csIds = null;

  for (const u of units) {
    // ── 3d / 1d / 30m reminders ───────────────────────────────────────────
    for (const [i, stage] of STAGES.entries()) {
      const due = u.start.getTime() - stage.lead;
      const stale = i + 1 < STAGES.length ? u.start.getTime() - STAGES[i + 1].lead : u.start.getTime();
      if (now.getTime() < due || now.getTime() >= stale) continue;
      // Assigned after this stage's moment: the assignment email already did its job.
      if (u.assignedAt.getTime() > due) continue;
      const r = await emitIfAbsent("duty_reminder", {
        recipient: u.teacherId,
        role: u.role,
        refModel: "Duty",
        refId: u.dutyId,
        dedupeKey: `duty_reminder:${u.teacherId}:${u.key}:${stage.id}`,
        data: { ...u.data, stage: stage.id, unconfirmed: u.unconfirmed },
      });
      if (r) tally.reminders += 1;
    }

    if (!u.unconfirmed) continue;
    const untilStart = u.start.getTime() - now.getTime();
    const sinceAssigned = now.getTime() - u.assignedAt.getTime();

    // ── Nudge the teacher to confirm ──────────────────────────────────────
    if (sinceAssigned >= CONFIRM_NUDGE_AFTER && untilStart > 30 * MIN) {
      const r = await emitIfAbsent("duty_confirm_nudge", {
        recipient: u.teacherId,
        role: u.role,
        refModel: "Duty",
        refId: u.dutyId,
        dedupeKey: `duty_confirm_nudge:${u.teacherId}:${u.key}`,
        data: u.data,
      });
      if (r) tally.nudges += 1;
    }

    // ── Escalate to CS the day before ─────────────────────────────────────
    if (untilStart <= CS_ALERT_WITHIN && sinceAssigned >= CS_ALERT_GRACE) {
      if (!csIds) csIds = await userService.getCsUserIds();
      for (const cs of csIds) {
        const r = await emitIfAbsent("duty_unconfirmed_alert", {
          recipient: cs,
          refModel: "Duty",
          refId: u.dutyId,
          dedupeKey: `duty_unconfirmed_alert:${cs}:${u.teacherId}:${u.key}`,
          data: { ...u.data, teacherName: u.teacherName },
        });
        if (r) tally.csAlerts += 1;
      }
    }
  }

  return tally;
};

/**
 * Where each role still has open slots, per exam group starting within a week:
 * Map<examGroupId, { group, roles: Set<role> }>.
 */
const examGroupsWithOpenSlots = async (now) => {
  const groups = await ExamGroup.find({
    startDate: { $gte: utcDayStart(0), $lt: new Date(now.getTime() + SELECT_STAGES[0].within) },
  });
  const out = new Map();
  for (const group of groups) {
    const schedules = await ExamSchedule.find({ examGroup: group._id, date: { $gte: utcDayStart(0) } }).select("_id");
    const scheduleIds = schedules.map((s) => s._id);
    if (scheduleIds.length === 0) continue;
    const rooms = await ExamRoom.find({ schedule: { $in: scheduleIds } }).select("_id");
    const taken = await Duty.find({
      examSchedule: { $in: scheduleIds },
      status: { $in: ["assigned", "completed"] },
    }).select("examRoom role");
    const filled = { invigilator: new Set(), rs: new Set() };
    for (const d of taken) if (filled[d.role] && d.examRoom) filled[d.role].add(String(d.examRoom));

    const roles = new Set();
    if (rooms.some((r) => !filled.invigilator.has(String(r._id)))) roles.add("invigilator");
    if (rooms.some((r) => !filled.rs.has(String(r._id)))) roles.add("rs");
    if (await DCSGroup.exists({ examGroup: group._id, status: "open" })) roles.add("dcs");
    if (roles.size > 0) out.set(String(group._id), { group, roles });
  }
  return out;
};

/**
 * "Please select your duties" — teachers still below their target when an exam
 * with open slots for their role starts within 7 days, then again within 3.
 * Runs with the 6-hourly sweep; there's no minute-level urgency here.
 */
const runSelectionNudgeSweep = async () => {
  const now = new Date();
  const open = await examGroupsWithOpenSlots(now);
  if (open.size === 0) return 0;

  const { teachers } = await calculateAllTeachersProgress();
  // teacherId → roles they're still short on
  const short = new Map();
  for (const row of teachers) {
    if (!row.eligible || !(row.target > 0) || row.assigned >= row.target) continue;
    const id = String(row.teacherId);
    if (!short.has(id)) short.set(id, { roles: new Set(), remaining: 0 });
    short.get(id).roles.add(row.role);
    short.get(id).remaining += row.target - row.assigned;
  }

  let sent = 0;
  for (const [teacherId, { roles, remaining }] of short) {
    for (const { group, roles: openRoles } of open.values()) {
      if (![...roles].some((r) => openRoles.has(r))) continue;
      const untilStart = new Date(group.startDate).getTime() - now.getTime();
      // Tightest stage that applies; each fires once per teacher per exam.
      const stage = [...SELECT_STAGES].reverse().find((s) => untilStart <= s.within);
      if (!stage) continue;
      const r = await emitIfAbsent("duty_selection_nudge", {
        recipient: teacherId,
        dedupeKey: `duty_selection_nudge:${teacherId}:${group._id}:${stage.id}`,
        data: {
          examLabel: group.examType,
          semester: group.semester,
          date: group.startDate,
          remaining,
          stage: stage.id,
        },
      });
      if (r) sent += 1;
    }
  }
  return sent;
};

module.exports = { runReminderTick, runSelectionNudgeSweep, STAGES };
