const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const examRoomSchema = new mongoose.Schema(
  {
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: [true, "Schedule is required"],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room is required"],
    },
    // The exam group (department card) this room belongs to. Only matters on a
    // schedule shared by several groups; null means the schedule's owner.
    examGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      default: null,
    },
    departments: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

examRoomSchema.index({ schedule: 1, room: 1 }, { unique: true });

examRoomSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("ExamRoom", examRoomSchema);
