const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const ciePlanEntrySchema = new mongoose.Schema(
  {
    examGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamGroup",
      required: [true, "Exam group is required"],
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: [true, "Schedule is required"],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
  },
  { timestamps: true }
);

// A (examGroup, schedule, department) slot may now hold multiple courses when
// an elective group is scheduled — each member course gets its own entry that
// shares the schedule + room set. Course is part of the uniqueness key.
ciePlanEntrySchema.index(
  { examGroup: 1, schedule: 1, department: 1, course: 1 },
  { unique: true }
);

ciePlanEntrySchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("CIEPlanEntry", ciePlanEntrySchema);
