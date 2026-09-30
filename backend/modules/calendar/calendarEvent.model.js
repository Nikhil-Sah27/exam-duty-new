const mongoose = require("mongoose");

/**
 * What each teacher's calendar was last told about one duty unit — a teacher's
 * duty in one exam slot (an invigilator room, or a whole RS / DCS group).
 *
 * This is the "last sent" side of the calendar reconciliation in
 * calendar.sync.js: comparing it with the live duties is how we know whether to
 * send a new invite, an update, a cancellation, or nothing.
 */
const calendarEventSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // `${scheduleId or legacy dutyId}|${role}` — see unitKey in calendar.sync.js.
    key: { type: String, required: true },
    // Stable for the life of the event; calendars match updates/cancels on it.
    uid: { type: String, required: true },
    // Must rise on every update or cancellation, or clients ignore the change.
    sequence: { type: Number, default: 0 },
    // Hash of what was sent (time, place, wording). Unchanged → send nothing.
    fingerprint: { type: String, required: true },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    // When the duty ends. Past events are left alone — a duty that has simply
    // happened must not be "cancelled" out of someone's calendar.
    endsAt: { type: Date, required: true },
    // Last-sent start / title / place — a cancellation repeats them so every
    // client can match it to the event it holds.
    startsAt: { type: Date, default: null },
    summary: { type: String, default: null },
    location: { type: String, default: null },
  },
  { timestamps: true }
);

calendarEventSchema.index({ teacher: 1, key: 1 }, { unique: true });
calendarEventSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);
