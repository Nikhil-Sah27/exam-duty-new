const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Course code is required"],
      trim: true,
      uppercase: true,
    },
    credits: {
      type: Number,
      required: [true, "Credits are required"],
      min: 1,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester is required"],
    },
    // A course is either "core" or an "elective" (grouped under an
    // ElectiveGroup). There is no finer professional/open distinction.
    courseType: {
      type: String,
      enum: ["core", "elective"],
      default: "core",
    },
    electiveGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElectiveGroup",
      default: null,
    },
    exams: {
      ia1: { type: Boolean, default: false },
      ia2: { type: Boolean, default: false },
      ia3: { type: Boolean, default: false },
      see: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

courseSchema.index({ semester: 1, code: 1 }, { unique: true });

courseSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Course", courseSchema);
