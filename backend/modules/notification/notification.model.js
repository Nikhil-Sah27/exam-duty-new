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
        "duty_cancelled",
        "request_submitted",
        "request_approved",
        "request_rejected",
        "duty_swapped",
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
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
