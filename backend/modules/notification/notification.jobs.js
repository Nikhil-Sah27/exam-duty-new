// Scheduled notification generators — the two "state-derived" alerts that have
// no natural event hook: a duty happening tomorrow, and a teacher completing
// their whole duty target. Both are idempotent (dedupeKey), so the sweep can
// run repeatedly without ever double-notifying a teacher.

const Duty = require("../duty/duty.model");
const {
  calculateAllTeachersProgress,
} = require("../duty-calculation/dutyCalculation.service");
const { emitIfAbsent } = require("./notification.emitter");

// Duty dates are stored at UTC midnight (created from date-only strings), so we
// match "tomorrow" in UTC to avoid a timezone-induced off-by-one.
const utcDayStart = (offsetDays) => {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offsetDays,
    ),
  );
};

const utcDateKey = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// Building-aware room label for reminders. Matches the app-wide convention
// ("<Building> — <RoomNumber>"). Falls back to the legacy `room` string label
// when a duty has no roomRef (e.g. older records).
const buildRoomLabel = (duty) => {
  const room = duty.roomRef;
  const buildingName = room?.building?.name;
  const roomNumber = room?.roomNumber;
  if (buildingName && roomNumber) return `${buildingName} — ${roomNumber}`;
  if (roomNumber) return roomNumber;
  return duty.room || "";
};

/**
 * Collapse a teacher's duties into "duty-units": an RS/DCS group is many
 * room-duties sharing a schedule + role, so it counts once; each invigilator
 * duty counts once. Keyed on (schedule, role) — a teacher can hold at most one
 * group per role per schedule (the time-slot conflict guard enforces it), so
 * this partition matches the group cards on the dashboard.
 */
const collapseIntoUnits = (duties) => {
  const unitMap = new Map();
  for (const d of duties) {
    const scheduleKey = (d.examSchedule || d.exam || d._id).toString();
    const key = `${scheduleKey}|${d.role}`;
    if (!unitMap.has(key)) unitMap.set(key, []);
    unitMap.get(key).push(d);
  }
  // Order units by earliest start (each unit's rooms share one start time).
  return [...unitMap.values()].sort((a, b) =>
    a[0].startTime < b[0].startTime ? -1 : a[0].startTime > b[0].startTime ? 1 : 0
  );
};

/**
 * Label for a single reminder unit. One room → the building-aware room label;
 * a group → "<Building> · N rooms" (or just "N rooms" when it spans buildings).
 */
const reminderUnitLabel = (unit) => {
  if (unit.length === 1) return buildRoomLabel(unit[0]);
  const buildings = new Set(
    unit.map((d) => d.roomRef?.building?.name).filter(Boolean)
  );
  const rooms = `${unit.length} rooms`;
  return buildings.size === 1 ? `${[...buildings][0]} · ${rooms}` : rooms;
};

/**
 * Remind every teacher who has an assigned duty tomorrow. Aggregated to one
 * notification per teacher per day (with a count), keyed on the date.
 */
const runDutyReminderSweep = async () => {
  const start = utcDayStart(1); // tomorrow 00:00 UTC
  const end = utcDayStart(2); // day-after 00:00 UTC
  const dayKey = utcDateKey(start);

  const duties = await Duty.find({
    status: "assigned",
    date: { $gte: start, $lt: end },
  })
    .populate({
      path: "roomRef",
      select: "roomNumber building",
      populate: { path: "building", select: "name" },
    })
    .sort({ startTime: 1 });

  const byTeacher = new Map();
  for (const d of duties) {
    if (!d.teacher) continue;
    const key = String(d.teacher);
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key).push(d);
  }

  let created = 0;
  for (const [teacherId, list] of byTeacher) {
    // Count groups, not rooms — a DCS/RS group of N rooms is ONE duty-unit.
    const units = collapseIntoUnits(list);
    const firstUnit = units[0];
    const first = firstUnit[0];
    const result = await emitIfAbsent("duty_reminder", {
      recipient: teacherId,
      dedupeKey: `duty_reminder:${teacherId}:${dayKey}`,
      data: {
        room: reminderUnitLabel(firstUnit),
        date: first.date,
        startTime: first.startTime,
        endTime: first.endTime,
        count: units.length,
      },
    });
    if (result) created += 1;
  }
  return created;
};

/**
 * Congratulate eligible teachers who have completed their whole duty target.
 * Keyed on the target value, so it fires once per target — and again only if a
 * later exam cycle raises their target.
 */
const runTargetReachedSweep = async () => {
  const { teachers } = await calculateAllTeachersProgress({ eligibleOnly: true });

  let created = 0;
  for (const t of teachers) {
    if (!t.eligible || t.target <= 0 || t.remaining > 0) continue;
    const result = await emitIfAbsent("target_reached", {
      recipient: t.teacherId,
      dedupeKey: `target_reached:${t.teacherId}:${t.target}`,
      data: { target: t.target },
    });
    if (result) created += 1;
  }
  return created;
};

/**
 * Run both sweeps. Each is isolated so one failing never blocks the other.
 */
const runDailySweep = async () => {
  // The day-before reminder moved to reminder.jobs.js (per duty unit, at 3 days,
  // 1 day and 30 minutes); runDutyReminderSweep stays exported for scripts.
  try {
    const n = await runTargetReachedSweep();
    if (n > 0) console.log(`[notifications] target-reached sweep: ${n} sent`);
  } catch (err) {
    console.error("[notifications] target-reached sweep failed:", err.message);
  }
};

module.exports = {
  runDailySweep,
  runDutyReminderSweep,
  runTargetReachedSweep,
};
