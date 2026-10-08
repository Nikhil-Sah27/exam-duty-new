const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const electiveGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Elective group name is required"],
      trim: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester is required"],
    },
  },
  { timestamps: true }
);

electiveGroupSchema.index({ semester: 1, name: 1 }, { unique: true });

electiveGroupSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("ElectiveGroup", electiveGroupSchema);
