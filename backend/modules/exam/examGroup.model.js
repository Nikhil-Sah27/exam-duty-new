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

// Exclude inactive from find queries by default
examGroupSchema.pre(/^find/, function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: true });
  }
});

examGroupSchema.plugin(collegeScoped, { examTypeFilter: true }); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("ExamGroup", examGroupSchema);
