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
