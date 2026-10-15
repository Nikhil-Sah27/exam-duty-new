const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

// Records a consumer exam group's borrow of N seats from a shareable room owned
// by another exam group. The consumer does NOT get its own ExamRoom for this
// room — the physical reservation stays with the source group. This record is
// the only artefact linking the consumer schedule to the borrowed room.
const sharedSeatAllocationSchema = new mongoose.Schema(
  {
    sharingConfiguration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomSharingConfiguration",
      required: true,
    },
    // Denormalised for cascade + read speed.
    sourceExamRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamRoom",
      required: true,
    },
    sourceExamGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: true,
    },
    consumerExamGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: true,
    },
    consumerSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    consumerDepartmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    studentsAllocated: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

sharedSeatAllocationSchema.index({ sharingConfiguration: 1 });
sharedSeatAllocationSchema.index({ consumerExamGroup: 1 });
sharedSeatAllocationSchema.index({ consumerSchedule: 1 });
sharedSeatAllocationSchema.index({ sourceExamGroup: 1 });
sharedSeatAllocationSchema.index({ sourceExamRoom: 1 });

sharedSeatAllocationSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model(
  "SharedSeatAllocation",
  sharedSeatAllocationSchema
);
