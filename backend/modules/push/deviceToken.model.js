const mongoose = require("mongoose");

/**
 * A phone running the Proctavo app that wants pushes for a user.
 *
 * One row per Expo push token. The token is unique, so re-registering the same
 * phone under a different login simply moves it to the new user — a shared or
 * handed-down phone never buzzes for its previous owner.
 */
const deviceTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Expo push token, e.g. "ExponentPushToken[xxxxxxxx]".
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    appVersion: { type: String, default: null },
    // Refreshed on every registration (app start) — lets stale devices be pruned.
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeviceToken", deviceTokenSchema);
