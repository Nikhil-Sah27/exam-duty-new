const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const examGroupSchema = new mongoose.Schema(
  {
    examType: {
      type: String,
      required: [true, "Exam type is required"],
      enum: ["IA1", "IA2", "IA3", "SEE"],
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 8,
    },
    // SEE exams created via the multi-department flow are scoped to a single
    // department so each (department, semester) renders as its own exam card.
    // Optional + null for CIE and legacy multi-dept SEE groups, which continue
    // to aggregate departments from their ExamRooms.
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

examGroupSchema.index({ examType: 1, semester: 1 });
examGroupSchema.index({ examType: 1, semester: 1, department: 1 });

// Exclude inactive from find queries by default
examGroupSchema.pre(/^find/, function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: true });
  }
});

examGroupSchema.plugin(collegeScoped, { examTypeFilter: true }); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("ExamGroup", examGroupSchema);
