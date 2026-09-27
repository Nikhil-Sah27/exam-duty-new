// Minimal in-process scheduler for the notification sweeps. No external cron
// dependency — a first run shortly after boot, then every few hours. Sweeps are
// idempotent, so the frequent dev-server (nodemon) restarts are harmless.

const { runDailySweep } = require("./notification.jobs");

const INITIAL_DELAY_MS = 10 * 1000; // let the server settle first
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

let started = false;

const startNotificationScheduler = () => {
  if (started) return; // guard against double-start within a process
  started = true;

  setTimeout(() => {
    runDailySweep();
    setInterval(runDailySweep, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
};

module.exports = { startNotificationScheduler };
