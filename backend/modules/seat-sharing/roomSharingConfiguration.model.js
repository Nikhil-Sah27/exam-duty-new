const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

// One-per-ExamRoom configuration record that opts an existing room reservation
// into the global seat-sharing pool. The ExamRoom itself remains the sole
// reservation authority (via RoomReservationService); this record only carries
// the shareability state and running seat counter.
const roomSharingConfigurationSchema = new mongoose.Schema(
  {
    examRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamRoom",
      required: true,
      unique: true,
    },
    sourceExamGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: true,
    },
    sourceSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    // Owner department code (matches ExamRoom.departments entries).
    sourceDepartmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    shareable: {
      type: Boolean,
      default: true,
    },
    initialShareableSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    // Decremented on allocation, restored on release. Guarded with a $gte check
    // on the atomic allocation path so two concurrent consumers can't over-draw.
    remainingSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

roomSharingConfigurationSchema.index({ sourceSchedule: 1, shareable: 1 });
roomSharingConfigurationSchema.index({ sourceExamGroup: 1 });

roomSharingConfigurationSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model(
  "RoomSharingConfiguration",
  roomSharingConfigurationSchema
);
