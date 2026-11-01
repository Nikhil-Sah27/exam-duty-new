const mongoose = require("mongoose");

/**
 * The platform-wide ads master switch (ADS_PLAN.md) — one document, keyed
 * "platform". Platform-level like College, so it does NOT take the
 * collegeScoped plugin: only the superadmin writes it, every college reads it.
 */
const adSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "platform", unique: true },
    adsEnabled: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdSettings", adSettingsSchema);
