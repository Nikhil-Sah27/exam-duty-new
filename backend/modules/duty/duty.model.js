const mongoose = require("mongoose");
const { signalDutyChangesFrom } = require("../../shared/realtime");

const dutySchema = new mongoose.Schema(
  {
    // Legacy reference to the single-exam model. Optional now — duties created
    // from the new ExamGroup/ExamSchedule flow set `examSchedule` + `examRoom`
    // instead. Validation that at least one path is present lives in the
    // service layer, since Mongoose doesn't express OR-required cleanly.
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      default: null,
    },
    examSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      default: null,
    },
    examRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamRoom",
      default: null,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher is required"],
    },
    // Which role slot this duty fills. Since a teacher can hold multiple roles
    // (e.g. Associate Professor = rs + invigilator), the Duty needs to record
    // *which* slot was claimed so per-role room-occupancy is unambiguous.
    role: {
      type: String,
      enum: ["dcs", "rs", "invigilator"],
      required: [true, "Duty role is required"],
    },
    room: {
      type: String,
      required: [true, "Room is required"],
      trim: true,
    },
    // Physical Room reference — the source of truth for conflict scans.
    // `room` (String) is a display label (just the room number) and collides
    // across buildings; roomRef is scoped to a specific building's room.
    roomRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    date: {
      type: Date,
      required: [true, "Duty date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [/^\d{2}:\d{2}$/, "Use HH:MM format"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [/^\d{2}:\d{2}$/, "Use HH:MM format"],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isSelfAssigned: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["assigned", "completed", "cancelled"],
      default: "assigned",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: null,
    },
    // The teacher has acknowledged this duty (REMINDERS_PLAN.md). CS-assigned
    // duties start unconfirmed; ones the teacher chose — a self-claim, or a
    // change request they raised — are confirmed at creation.
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedVia: {
      type: String,
      enum: ["self", "request", "email", "app", null],
      default: null,
    },
  },
  { timestamps: true }
);

dutySchema.pre("validate", function confirmSelfClaims() {
  if (this.isNew && this.isSelfAssigned && !this.confirmedAt) {
    this.confirmedAt = new Date();
    this.confirmedVia = "self";
  }
});

// One live duty per slot per role. An ExamRoom is one room in one schedule, so
// this is exactly "one invigilator / RS / DCS per room per exam" — enforced by
// Mongo, because the service's check-then-insert can be raced by concurrent
// claims (5 teachers clicking the same duty at once). Cancelled duties drop out
// of the index so a released slot can be claimed again; legacy exam-based
// duties without an examRoom are not covered. Writers that move a duty
// (swap/move approvals) cancel the old one before creating the new one.
// Production check: scripts/check-duplicate-duties.js.
dutySchema.index(
  { examRoom: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "assigned", examRoom: { $type: "objectId" } },
    name: "one_live_duty_per_slot",
  }
);

// Compound index — one teacher per time slot, one room per time slot
dutySchema.index({ teacher: 1, date: 1, startTime: 1, status: 1 });
dutySchema.index({ room: 1, date: 1, startTime: 1, status: 1 });
dutySchema.index({ roomRef: 1, date: 1, startTime: 1, status: 1 });
dutySchema.index({ roomRef: 1, role: 1, date: 1, startTime: 1, status: 1 });

// Any change to who holds what pings open pages to refetch (shared/realtime).
signalDutyChangesFrom(dutySchema);

const Duty = mongoose.model("Duty", dutySchema);

// Index builds run at boot and fail silently — e.g. when duplicate live duties
// from before the one-per-slot index make it unbuildable. Say so in the log.
Duty.on("index", (err) => {
  if (err) {
    console.error(
      `[duty] index build failed — concurrent claims are NOT protected until fixed: ${err.message}\n` +
        "       Run: node scripts/check-duplicate-duties.js"
    );
  }
});

module.exports = Duty;
