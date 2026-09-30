const mongoose = require("mongoose");

/**
 * Transactional outbox for notification emails.
 *
 * A row is written in the SAME transaction as the `Notification` it mirrors
 * (see `notification.emitter.js`), and a background dispatcher
 * (`mail.dispatcher.js`) sends it afterwards. That ordering is deliberate:
 *
 *   - A rolled-back transaction takes its queued emails with it, so a teacher
 *     can never be emailed about a duty that was never created.
 *   - SMTP latency and outages stay off the request path — assigning a duty
 *     never waits on, or fails because of, a mail server.
 *   - Delivery is auditable and retryable, which matters when the question is
 *     "was this teacher actually told about their exam duty?".
 */
const emailOutboxSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The notification this email mirrors. Null only if a future caller
    // enqueues a mail with no in-app counterpart.
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
    },
    // Notification type (e.g. "duty_assigned") — drives the email template and
    // the per-type policy in mail.policy.js.
    type: { type: String, required: true },
    // Rendered in-app copy, reused as the email's subject/body baseline so the
    // two channels never drift apart in wording.
    title: { type: String, required: true },
    message: { type: String, required: true },
    // Raw template payload (room, date, times, examLabel, …) so the email can
    // render a richer details block than the one-line in-app message.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    // Earliest time this row may be attempted — moves forward on each retry.
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String, default: null },
    // Why a row was skipped rather than sent (no address, deactivated user,
    // user preference). Kept so "why didn't they get the mail?" is answerable.
    skipReason: { type: String, default: null },
    sentAt: { type: Date, default: null },
    messageId: { type: String, default: null },
    // Mirrors the notification's dedupe key for the idempotent sweeps. Purely
    // for traceability — duplicate suppression already happened upstream, since
    // no notification means no outbox row.
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true }
);

// The dispatcher's claim query.
emailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
// "What did we try to send this person?" — the delivery audit view.
emailOutboxSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("EmailOutbox", emailOutboxSchema);
