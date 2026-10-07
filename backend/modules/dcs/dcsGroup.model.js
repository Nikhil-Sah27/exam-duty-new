const mongoose = require("mongoose");
const { signalDutyChangesFrom } = require("../../shared/realtime");

/**
 * A DCSGroup is the unit a DCS user claims at "Select Duty" time. It is
 * created at exam-creation time (one set per ExamSchedule) so the required
 * number of DCS slots is locked when the students/departments are known —
 * later edits to seat counts do not silently change the requirement.
 *
 * Sizing rule:  N = ceil(totalStudents / 300)  → one DCSGroup per N.
 * Class split: floor(rooms / N) per group, with the remainder spread
 *              sequentially to the earliest groups (group 1 → group 2 → …).
 *
 * Shared-room rule: ExamRooms are already merged on (schedule, room) at
 * creation, so each physical room appears once per schedule. Counting rooms
 * here therefore never duplicates them — the rule is satisfied structurally.
 */
const dcsGroupSchema = new mongoose.Schema(
  {
    examGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: true,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    /** 1-based index within the schedule (group 1, group 2, …). */
    groupIndex: {
      type: Number,
      required: true,
      min: 1,
    },
    /** Total number of DCS groups generated for this schedule. */
    dcsRequired: {
      type: Number,
      required: true,
      min: 1,
    },
    /** ExamRoom._ids covered by this DCS slot. */
    assignedRooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExamRoom",
      },
    ],
    /** Union of department codes across the assigned rooms. */
    assignedDepartments: [{ type: String, trim: true, uppercase: true }],
    /** Sum of Semester.studentCount across the assigned (dept × semester). */
    assignedStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /**
     * Per-room Duty docs created when a DCS claims the group. Mirrors the RS
     * flow — keeps the existing Duty plumbing (reports, change-requests,
     * notifications, conflict-checks) working without duplication.
     */
    duties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Duty",
      },
    ],
    status: {
      type: String,
      enum: ["open", "claimed", "released"],
      default: "open",
    },
  },
  { timestamps: true }
);

dcsGroupSchema.index({ schedule: 1, groupIndex: 1 }, { unique: true });
dcsGroupSchema.index({ assignedTeacher: 1, status: 1 });
dcsGroupSchema.index({ examGroup: 1 });

// Any change to who holds what pings open pages to refetch (shared/realtime).
signalDutyChangesFrom(dcsGroupSchema);

module.exports = mongoose.model("DCSGroup", dcsGroupSchema);
