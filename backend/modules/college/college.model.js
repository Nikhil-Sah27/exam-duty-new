const mongoose = require("mongoose");
const { FEATURES } = require("../../shared/tenancy/features");

// A college is a tenant (MULTI_COLLEGE_PLAN.md): every other collection's
// documents belong to exactly one. This model itself is platform-level, so it
// does NOT take the collegeScoped plugin.

const featuresShape = Object.fromEntries(
  Object.entries(FEATURES).map(([key, f]) => [key, { type: Boolean, default: f.default }])
);

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "College name is required"],
      trim: true,
      unique: true,
    },
    // Short handle shown next to the name (e.g. "RVCE"). Letters, digits, dashes.
    code: {
      type: String,
      required: [true, "College code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      match: [/^[A-Z0-9-]{2,16}$/, "Code: 2–16 letters, digits or dashes"],
    },
    // Suspended colleges keep their data but nobody in them can sign in.
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    features: { type: new mongoose.Schema(featuresShape, { _id: false }), default: () => ({}) },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("College", collegeSchema);
