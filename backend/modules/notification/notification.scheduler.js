// Minimal in-process scheduler for the notification sweeps. No external cron
// dependency — a first run shortly after boot, then every few hours. Sweeps are
// idempotent, so the frequent dev-server (nodemon) restarts are harmless.

const { runDailySweep } = require("./notification.jobs");
const calendarSync = require("../calendar/calendar.sync");

// Calendar reconciliation rides the same cadence: it catches duty changes that
// notify nobody, and its first run after a deploy is the invite backfill.
const runSweeps = async () => {
  await runDailySweep();
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
  }, INITIAL_DELAY_MS);
};

module.exports = { startNotificationScheduler };
