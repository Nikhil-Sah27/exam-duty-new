const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const examScheduleSchema = new mongoose.Schema(
  {
    examGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: [true, "Exam group is required"],
    },
    // Other exam groups sitting in this same slot. SEE departments of one
    // semester that write at the same date + time share ONE schedule (so RS
    // chunks and DCS sizing span all their rooms) while keeping their own
    // exam cards; `examGroup` is the owner, these are the joiners. Each
    // ExamRoom records which group it belongs to.
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExamGroup",
      },
    ],
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [/^\d{2}:\d{2}$/, "End time must be in HH:MM format"],
    },
  },
  { timestamps: true }
);

examScheduleSchema.index({ examGroup: 1, date: 1 });
examScheduleSchema.index({ sharedWith: 1 });

examScheduleSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);
