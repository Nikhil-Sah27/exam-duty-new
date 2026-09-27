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
  }).sort({ startTime: 1 });

  const byTeacher = new Map();
  for (const d of duties) {
    if (!d.teacher) continue;
    const key = String(d.teacher);
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key).push(d);
  }

  let created = 0;
  for (const [teacherId, list] of byTeacher) {
    const first = list[0];
    const result = await emitIfAbsent("duty_reminder", {
      recipient: teacherId,
      dedupeKey: `duty_reminder:${teacherId}:${dayKey}`,
      data: {
        room: first.room,
        date: first.date,
        startTime: first.startTime,
        endTime: first.endTime,
        count: list.length,
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
  try {
    const n = await runDutyReminderSweep();
    if (n > 0) console.log(`[notifications] duty-reminder sweep: ${n} sent`);
  } catch (err) {
    console.error("[notifications] duty-reminder sweep failed:", err.message);
  }
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
