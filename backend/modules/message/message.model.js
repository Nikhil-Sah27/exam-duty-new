const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

/** A single emoji reaction — one per user per message (latest replaces). */
const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    /** True when sent from the CS side; false when sent by the teacher. */
    senderIsCs: { type: Boolean, required: true },
    body: {
      type: String,
      // Allowed empty once deleted (tombstone keeps the row for ordering).
      required: [
        function () {
          return !this.deleted;
        },
        "Message body is required",
      ],
      trim: true,
      maxlength: [4000, "Message is too long"],
    },
    /** The message this one quotes/replies to, if any. */
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    /** Emoji reactions from either participant. */
    reactions: { type: [reactionSchema], default: [] },
    /** Set when the sender edits the body; drives the "edited" label. */
    editedAt: { type: Date, default: null },
    /** Deleted-for-everyone tombstone; body is cleared and UI shows a notice. */
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Message", messageSchema);
