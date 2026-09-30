const mongoose = require("mongoose");

/**
 * A 1:1 support conversation between one teacher (Invigilator / RS / DCS) and
 * the CS "desk". Keyed by the teacher — every teacher has exactly one thread
 * with CS; CS sees them all as an inbox. Unread counters are kept per side so
 * both the teacher and CS can show badges without scanning every message.
 */
const conversationSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    lastMessageBody: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastSenderIsCs: { type: Boolean, default: false },
    /** Messages the CS hasn't read yet. */
    csUnread: { type: Number, default: 0 },
    /** Messages the teacher hasn't read yet. */
    teacherUnread: { type: Number, default: 0 },
    /** When CS last read this thread — drives read-receipt ticks on teacher msgs. */
    csLastReadAt: { type: Date, default: null },
    /** When the teacher last read — drives read-receipt ticks on CS msgs. */
    teacherLastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
