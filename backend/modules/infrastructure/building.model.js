const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const buildingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Building name is required"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Unique within a college — two colleges may both have "Block A".
buildingSchema.index({ college: 1, name: 1 }, { unique: true });

buildingSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Building", buildingSchema);
