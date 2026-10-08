const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Unique within a college — two colleges may both have "CSE".
departmentSchema.index({ college: 1, name: 1 }, { unique: true });
departmentSchema.index({ college: 1, code: 1 }, { unique: true });

departmentSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Department", departmentSchema);
