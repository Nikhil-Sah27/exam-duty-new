/**
 * Device registration + the enqueue side of push. Callers never send directly:
 * the notification emitter writes an outbox row (inside the caller's
 * transaction, when there is one) and push.dispatcher.js delivers it.
 *
 * Nothing on the enqueue path may throw into its caller — a push problem must
 * never fail a duty assignment. Those paths log and return null instead.
 */
const AppError = require("../../shared/utils/AppError");
const pushRepository = require("./push.repository");
const policy = require("./push.policy");
const transport = require("./push.transport");

// Expo push tokens look like ExponentPushToken[...] (or ExpoPushToken[...]).
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const registerDevice = async (userId, { token, platform, appVersion } = {}) => {
  if (!token || !EXPO_TOKEN.test(String(token).trim())) {
    throw new AppError("A valid Expo push token is required", 400);
  }
  if (!["android", "ios"].includes(platform)) {
    throw new AppError('platform must be "android" or "ios"', 400);
  }
  const device = await pushRepository.upsertDevice({
    user: userId,
    token: String(token).trim(),
    platform,
    appVersion,
  });
  return { token: device.token, platform: device.platform };
};

/** Logout: forget this phone. Scoped to the caller so nobody can unregister someone else. */
const unregisterDevice = async (userId, token) => {
  if (!token) throw new AppError("token is required", 400);
  const res = await pushRepository.deleteDevice(String(token).trim(), userId);
  return { removed: res.deletedCount || 0 };
};

/** Routing payload the app reads on receipt/tap. Kept tiny — pushes are size-limited. */
const payloadFor = ({ notification, type, data }) => {
  const out = { type, sync: true };
  if (notification?._id || notification) out.notificationId = String(notification?._id || notification);
  if (data?.refDutyId) out.dutyId = String(data.refDutyId);
  if (data?.stage) out.stage = data.stage;
  return out;
};

const buildRow = (entry) => ({
  recipient: entry.recipient,
  notification: entry.notification?._id || entry.notification || null,
  type: entry.type,
  title: entry.title,
  message: entry.message,
  data: payloadFor(entry),
  status: "pending",
  nextAttemptAt: new Date(),
});

const wanted = (e) => e?.recipient && e?.type && policy.shouldPush(e.type);

/**
 * Queue a push for one just-written notification. Pass the caller's `session`
 * so it commits (or rolls back) with the notification it mirrors.
 */
const enqueueForNotification = async (entry, session = null) => {
  try {
    if (!transport.isEnabled() || !wanted(entry)) return null;
    return await pushRepository.createRow(buildRow(entry), session);
  } catch (err) {
    console.error(`[push] failed to enqueue ${entry?.type} push:`, err.message);
    return null;
  }
};

/** Batch version for `emitToMany` / `bulkEmit`. */
const enqueueManyForNotifications = async (entries, session = null) => {
  try {
    if (!transport.isEnabled()) return [];
    const rows = (entries || []).filter(wanted).map(buildRow);
    if (rows.length === 0) return [];
    return await pushRepository.createRows(rows, session);
  } catch (err) {
    console.error("[push] failed to enqueue batch pushes:", err.message);
    return [];
  }
};

module.exports = {
  registerDevice,
  unregisterDevice,
  enqueueForNotification,
  enqueueManyForNotifications,
  listForRecipient: pushRepository.listForRecipient,
};
