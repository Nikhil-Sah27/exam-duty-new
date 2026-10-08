const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Exam date is required"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 8,
    },
    type: {
      type: String,
      required: [true, "Exam type is required"],
      enum: ["internal", "external", "supplementary", "arrear"],
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Exclude cancelled exams from all find queries by default
examSchema.pre(/^find/, function () {
  if (this.getFilter().isCancelled === undefined) {
    this.where({ isCancelled: false });
  }
});

examSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Exam", examSchema);
