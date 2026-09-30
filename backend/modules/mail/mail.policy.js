/**
 * Per-notification-type email policy — the single place that decides whether a
 * notification also leaves the building as an email.
 *
 * Modes:
 *   "immediate" — enqueue an email as soon as the notification is created.
 *   "none"      — in-app only.
 *   "digest"    — batched into a once-daily summary. NOT YET IMPLEMENTED (the
 *                 digest sweep is Phase 5 of NOTIFICATIONS_PLAN.md); rows are
 *                 not enqueued, so these types are in-app only for now.
 */

const IMMEDIATE = "immediate";
const NONE = "none";
const DIGEST = "digest";

const POLICY = {
  // ── Duty lifecycle — operational, always emailed ─────────────────────────
  duty_assigned: IMMEDIATE,
  duty_group_assigned: IMMEDIATE,
  duty_self_claimed: IMMEDIATE,
  duty_cancelled: IMMEDIATE,
  duty_group_cancelled: IMMEDIATE,
  duty_swapped: IMMEDIATE,
  exam_deleted_duty_release: IMMEDIATE,
  exam_updated: IMMEDIATE,

  // ── Calendar invites (calendar.sync.js) — the event itself, so always sent ─
  calendar_request: IMMEDIATE,
  calendar_cancel: IMMEDIATE,

  // ── Change requests ─────────────────────────────────────────────────────
  request_submitted: IMMEDIATE,
  request_approved: IMMEDIATE,
  request_rejected: IMMEDIATE,

  // ── Reminders & nudges (reminder.jobs.js) ───────────────────────────────
  duty_reminder: IMMEDIATE,
  duty_confirm_nudge: IMMEDIATE,
  duty_selection_nudge: IMMEDIATE,
  // CS escalation — in-app, like the other CS awareness alerts.
  duty_unconfirmed_alert: NONE,

  // ── CS-facing awareness alerts (no email: CS lives in the app all day and
  //    these fire on every teacher action, so an inbox copy is pure noise) ──
  duty_claimed_by_teacher: NONE,
  duty_released_by_teacher: NONE,
  group_released: NONE,

  // ── Low-value-in-inbox ──────────────────────────────────────────────────
  target_reached: NONE,

  // ── High fan-out: one publish reaches every eligible teacher, which would
  //    burn a consumer Gmail's whole daily quota in a single action. Waiting
  //    on the daily digest (Phase 5). ─────────────────────────────────────
  exam_created: DIGEST,

  // CS chose to broadcast, so it goes out. A per-broadcast "also email"
  // toggle is Phase 3.
  announcement: IMMEDIATE,
};

// Duty facts a teacher must not be able to opt out of — they are operational
// instructions, not updates.
const NON_OPTIONAL = new Set([
  "duty_assigned",
  "duty_group_assigned",
  "duty_self_claimed",
  "duty_cancelled",
  "duty_group_cancelled",
  "calendar_request",
  "calendar_cancel",
  "duty_swapped",
  "exam_deleted_duty_release",
  "exam_updated",
]);

// Which preference switch (User.notificationPrefs.email.*) gates each type.
// The preferences UI is Phase 3; until it exists every lookup is undefined and
// therefore allowed, so this is inert-but-ready rather than speculative.
const PREF_CATEGORY = {
  duty_reminder: "reminders",
  duty_confirm_nudge: "reminders",
  duty_selection_nudge: "reminders",
  request_submitted: "requests",
  request_approved: "requests",
  request_rejected: "requests",
  announcement: "announcements",
  target_reached: "announcements",
};

const warnedUnknown = new Set();

/**
 * Email mode for a notification type. Unknown types default to "immediate":
 * the intent of this system is that anything worth telling a teacher in the app
 * is worth emailing, so a newly-added type opts IN by default. The warning
 * makes the omission visible so it gets a deliberate entry above.
 */
const policyFor = (type) => {
  const mode = POLICY[type];
  if (mode) return mode;
  if (!warnedUnknown.has(type)) {
    warnedUnknown.add(type);
    console.warn(
      `[mail] notification type "${type}" has no entry in mail.policy.js — defaulting to email. Add it to POLICY to make this explicit.`
    );
  }
  return IMMEDIATE;
};

const shouldEnqueue = (type) => policyFor(type) === IMMEDIATE;

/**
 * Per-user gate, applied by the dispatcher at send time (not at enqueue time)
 * so a preference change takes effect on already-queued mail.
 * Returns null when allowed, or a skip reason string.
 */
const blockReasonForUser = (user, type) => {
  if (!user) return "recipient no longer exists";
  if (user.isActive === false) return "recipient deactivated";
  if (!user.email) return "recipient has no email address";
  if (NON_OPTIONAL.has(type)) return null;

  const prefs = user.notificationPrefs?.email;
  if (!prefs) return null; // no preferences set → everything allowed
  if (prefs.enabled === false) return "recipient disabled email notifications";

  const category = PREF_CATEGORY[type];
  if (category && prefs[category] === false) {
    return `recipient disabled "${category}" emails`;
  }
  return null;
};

module.exports = {
  IMMEDIATE,
  NONE,
  DIGEST,
  POLICY,
  policyFor,
  shouldEnqueue,
  blockReasonForUser,
};
