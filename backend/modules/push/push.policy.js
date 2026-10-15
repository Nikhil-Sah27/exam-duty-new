/**
 * Per-notification-type push policy — the single place that decides whether a
 * notification also buzzes the recipient's phone. Mirrors mail/mail.policy.js.
 *
 * The app serves Invigilators, RS and DCS (CS works from the web dashboard), so
 * every teacher-facing type pushes and the CS awareness alerts don't.
 *
 * Unlike email there is no per-send quota to protect, so the `exam_created`
 * fan-out pushes too: "a new exam is open — pick your duties" is exactly what a
 * phone alert is for.
 */

const PUSH = "push";
const NONE = "none";

const POLICY = {
  // Duty lifecycle
  duty_assigned: PUSH,
  duty_group_assigned: PUSH,
  duty_self_claimed: PUSH,
  duty_cancelled: PUSH,
  duty_group_cancelled: PUSH,
  duty_swapped: PUSH,
  exam_deleted_duty_release: PUSH,
  exam_updated: PUSH,

  // Change requests — the teacher hears the outcome
  request_approved: PUSH,
  request_rejected: PUSH,

  // Reminders & nudges (reminder.jobs.js)
  duty_reminder: PUSH,
  duty_confirm_nudge: PUSH,
  duty_selection_nudge: PUSH,

  // Teacher-facing broadcast / progress
  exam_created: PUSH,
  announcement: PUSH,
  target_reached: PUSH,

  // CS-facing alerts — CS has no app.
  request_submitted: NONE, // goes to the CS reviewers
  duty_claimed_by_teacher: NONE,
  duty_released_by_teacher: NONE,
  group_released: NONE,
  duty_unconfirmed_alert: NONE,
};

// Time-critical types: high priority + iOS "time-sensitive" interruption level.
const URGENT = new Set([
  "duty_assigned",
  "duty_group_assigned",
  "duty_cancelled",
  "duty_group_cancelled",
  "duty_swapped",
  "exam_updated",
  "exam_deleted_duty_release",
  "duty_reminder",
]);

const warnedUnknown = new Set();

/** Unknown types push by default (same opt-in stance as mail), with a nudge to list them. */
const shouldPush = (type) => {
  const mode = POLICY[type];
  if (mode) return mode === PUSH;
  if (!warnedUnknown.has(type)) {
    warnedUnknown.add(type);
    console.warn(
      `[push] notification type "${type}" has no entry in push.policy.js — defaulting to push. Add it to POLICY to make this explicit.`
    );
  }
  return true;
};

const isUrgent = (type) => URGENT.has(type);

module.exports = { POLICY, shouldPush, isUrgent };
