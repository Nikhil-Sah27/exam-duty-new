// Minimal in-process scheduler for the notification sweeps. No external cron
// dependency — a first run shortly after boot, then every few hours. Sweeps are
// idempotent, so the frequent dev-server (nodemon) restarts are harmless.

const { runDailySweep } = require("./notification.jobs");
const calendarSync = require("../calendar/calendar.sync");
const { runReminderTick, runSelectionNudgeSweep } = require("./reminder.jobs");

// Minute-level work: the 30-minute reminder and the day-before CS escalation
// can't wait for a 6-hour sweep. Each pass is a cheap indexed query.
const TICK_MS = 5 * 60 * 1000;
let ticking = false;
const runTick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const t = await runReminderTick();
    if (t.reminders + t.nudges + t.csAlerts > 0) {
      console.log(`[reminders] ${t.reminders} reminders, ${t.nudges} confirm nudges, ${t.csAlerts} CS alerts`);
    }
  } catch (err) {
    console.error("[reminders] tick failed:", err.message);
  } finally {
    ticking = false;
  }
};

// Calendar reconciliation rides the same cadence: it catches duty changes that
// notify nobody, and its first run after a deploy is the invite backfill.
let backfilled = false;
const runSweeps = async () => {
  if (!backfilled) {
    backfilled = true;
    try {
      const n = await require("../duty/duty.service").backfillSelfClaimConfirmations();
      if (n > 0) console.log(`[reminders] marked ${n} earlier self-claimed duties as confirmed`);
    } catch (err) {
      console.error("[reminders] confirmation backfill failed:", err.message);
    }
  }
  await runDailySweep();
  try {
    const n = await runSelectionNudgeSweep();
    if (n > 0) console.log(`[reminders] ${n} select-your-duty nudges`);
  } catch (err) {
    console.error("[reminders] selection sweep failed:", err.message);
  }
  try {
    await calendarSync.runSweep();
  } catch (err) {
    console.error("[calendar] sweep failed:", err.message);
  }
};

const INITIAL_DELAY_MS = 10 * 1000; // let the server settle first
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

let started = false;

const startNotificationScheduler = () => {
  if (started) return; // guard against double-start within a process
  started = true;

  setTimeout(() => {
    runSweeps();
    setInterval(runSweeps, INTERVAL_MS);
    runTick();
    setInterval(runTick, TICK_MS);
  }, INITIAL_DELAY_MS);
};

module.exports = { startNotificationScheduler };
