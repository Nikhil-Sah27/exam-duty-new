const DeviceToken = require("./deviceToken.model");
const PushOutbox = require("./pushOutbox.model");

// ── Devices ────────────────────────────────────────────────────────────────

/** Register or refresh a device; a token seen under another user moves to this one. */
const upsertDevice = ({ user, token, platform, appVersion }) =>
  DeviceToken.findOneAndUpdate(
    { token },
    { $set: { user, platform, appVersion: appVersion || null, lastSeenAt: new Date() } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

/** Drop this token from every other college (call in the platform scope). */
const deleteTokenOutsideCollege = (token, college) => DeviceToken.deleteMany({ token, college: { $ne: college } });

const deleteDevice = (token, user) => DeviceToken.deleteOne(user ? { token, user } : { token });

const deleteDevicesByToken = (tokens) => DeviceToken.deleteMany({ token: { $in: tokens } });

const findDevicesForUser = (user) => DeviceToken.find({ user }).select("token platform").lean();

const countDevicesForUser = (user) => DeviceToken.countDocuments({ user });

// ── Outbox ─────────────────────────────────────────────────────────────────

const createRow = (doc, session) =>
  session ? PushOutbox.create([doc], { session }).then((r) => r[0]) : PushOutbox.create(doc);

const createRows = (docs, session) => PushOutbox.insertMany(docs, session ? { session } : {});

const findDueIds = (limit) =>
  PushOutbox.find({ status: "pending", nextAttemptAt: { $lte: new Date() } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("_id");

/** Atomically take ownership of one pending row (no double-send across restarts). */
const claimRow = (id) =>
  PushOutbox.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "processing" }, $inc: { attempts: 1 } },
    { new: true }
  );

const updateRow = (id, set) => PushOutbox.findByIdAndUpdate(id, set);

const listForRecipient = (recipient, limit = 50) =>
  PushOutbox.find({ recipient }).sort({ createdAt: -1 }).limit(limit).lean();

module.exports = {
  deleteTokenOutsideCollege,
  upsertDevice,
  deleteDevice,
  deleteDevicesByToken,
  findDevicesForUser,
  countDevicesForUser,
  createRow,
  createRows,
  findDueIds,
  claimRow,
  updateRow,
  listForRecipient,
};
