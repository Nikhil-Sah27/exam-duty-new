const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: [
        "duty_assigned",
        "duty_group_assigned",
        "duty_cancelled",
        "request_submitted",
        "request_approved",
        "request_rejected",
        "duty_swapped",
        "duty_reminder",
        "target_reached",
        "exam_created",
        "exam_deleted_duty_release",
        "announcement",
      ],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    // Optional reference to the entity that triggered the notification
    refModel: {
      type: String,
      enum: ["Duty", "ChangeRequest"],
      default: null,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Idempotency key for system-generated notifications (e.g. the daily
    // duty-reminder / target-reached sweeps). Lets a re-run skip a notification
    // it already created. Null for ordinary event notifications.
    dedupeKey: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// Enforce one notification per dedupeKey. A PARTIAL index (not sparse) is
// required here: the field defaults to `null` on every ordinary event
// notification, and a sparse-unique index would treat those nulls as values
// and reject the second one. The partial filter indexes ONLY string keys, so
// null/absent dedupeKeys are ignored entirely.
notificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  },
);

module.exports = mongoose.model("Notification", notificationSchema);
