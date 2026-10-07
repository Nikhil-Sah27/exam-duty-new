const mongoose = require("mongoose");

/**
 * Transactional outbox for push notifications — the phone-side twin of
 * `EmailOutbox` (see mail/emailOutbox.model.js for the full rationale).
 *
 * A row is written in the SAME transaction as the `Notification` it mirrors, so
 * a rolled-back duty assignment never buzzes a phone, and the Expo Push API's
 * latency/outages stay off the request path. One row per notification; it fans
 * out to all of the recipient's devices at send time, so a phone registered
 * after the row was queued still gets it.
 */
const pushOutboxSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
    },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    // Small routing payload for the app (type, notificationId, dutyId, stage).
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String, default: null },
    skipReason: { type: String, default: null },
    sentAt: { type: Date, default: null },
    // How many devices accepted it — "did their phone get told?" is answerable.
    deliveredTo: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pushOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
pushOutboxSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("PushOutbox", pushOutboxSchema);
