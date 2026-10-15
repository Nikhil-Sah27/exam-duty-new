const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      trim: true,
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: [true, "Building is required"],
    },
    floor: {
      type: Number,
      required: [true, "Floor is required"],
      min: 0,
    },
    capacity: {
      type: Number,
      required: [true, "Room capacity is required"],
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

roomSchema.index({ building: 1, roomNumber: 1 }, { unique: true });

roomSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("Room", roomSchema);
