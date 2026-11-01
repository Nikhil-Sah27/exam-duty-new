const mongoose = require("mongoose");
const { collegeScoped } = require("../../shared/tenancy/plugin");

/**
 * When a teacher fell behind on picking duties (ADS_PLAN.md). Exists only
 * while they are behind: created the first time a sweep or an app open sees
 * it, deleted once they catch up — so "days behind" counts from the real start.
 */
const adNudgeSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    behindSince: { type: Date, required: true },
    /** Duties still to pick, as of the last check. */
    remaining: { type: Number, default: 0 },
  },
  { timestamps: true }
);

adNudgeSchema.plugin(collegeScoped); // one college's data (MULTI_COLLEGE_PLAN.md)

module.exports = mongoose.model("AdNudge", adNudgeSchema);
