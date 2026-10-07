/**
 * Delivery side of push: drains `PushOutbox` and sends through the Expo Push
 * API. Same shape as mail/mail.dispatcher.js — out-of-band interval drain, an
 * atomic claim per row, backoff on failure, and a `kick()` for prompt delivery
 * after non-transactional emits. Rows queued inside an open transaction stay
 * invisible to the claim query until it commits.
 */
const pushRepository = require("./push.repository");
const transport = require("./push.transport");
const policy = require("./push.policy");

// Lazy: user.service is a sibling domain; keep load order independent.
const userService = () => require("../user/user.service");

const INTERVAL_MS = 15 * 1000;
const INITIAL_DELAY_MS = 8 * 1000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60];

// Android channel the app creates at startup (high importance, sound). Without a
// matching channel Android would drop to its default, silent-ish behaviour.
const ANDROID_CHANNEL = "duty-alerts";

let timer = null;
let kickTimer = null;
let draining = false;

const backoffFor = (attempts) => {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] || 60;
  return new Date(Date.now() + minutes * 60 * 1000);
};

const markFailure = (id, attempts, err) => {
  const givingUp = attempts >= MAX_ATTEMPTS;
  return pushRepository.updateRow(id, {
    status: givingUp ? "failed" : "pending",
    lastError: String(err?.message || err).slice(0, 500),
    ...(givingUp ? {} : { nextAttemptAt: backoffFor(attempts) }),
  });
};

/** A 30-minute reminder delivered an hour late is noise — let Expo drop it. */
const ttlFor = (row) => (row.type === "duty_reminder" && row.data?.stage === "30m" ? 30 * 60 : 2 * 24 * 3600);

const messageFor = (row, token) => {
  const urgent = policy.isUrgent(row.type);
  return {
    to: token,
    title: row.title,
    body: row.message,
    data: row.data || {},
    sound: "default",
    priority: "high",
    channelId: ANDROID_CHANNEL,
    ttl: ttlFor(row),
    ...(urgent ? { interruptionLevel: "time-sensitive" } : {}),
  };
};

/** Process one claimed row. Returns "sent" | "skipped" | "failed". */
const deliver = async (row) => {
  try {
    await userService().getUserById(row.recipient); // hides deactivated/deleted users
  } catch {
    await pushRepository.updateRow(row._id, { status: "skipped", skipReason: "recipient inactive or deleted" });
    return "skipped";
  }

  const devices = await pushRepository.findDevicesForUser(row.recipient);
  if (devices.length === 0) {
    await pushRepository.updateRow(row._id, { status: "skipped", skipReason: "no registered devices" });
    return "skipped";
  }

  try {
    const tickets = await transport.send(devices.map((d) => messageFor(row, d.token)));
    const dead = [];
    let ok = 0;
    const errors = [];
    tickets.forEach((t, i) => {
      if (t?.status === "ok") ok += 1;
      else if (t?.details?.error === "DeviceNotRegistered") dead.push(devices[i].token);
      else errors.push(t?.message || t?.details?.error || "unknown error");
    });
    if (dead.length) await pushRepository.deleteDevicesByToken(dead);

    if (ok > 0 || errors.length === 0) {
      await pushRepository.updateRow(row._id, {
        status: ok > 0 ? "sent" : "skipped",
        sentAt: ok > 0 ? new Date() : null,
        deliveredTo: ok,
        skipReason: ok > 0 ? null : "all devices unregistered",
        lastError: errors.length ? errors.join("; ").slice(0, 500) : null,
      });
      return ok > 0 ? "sent" : "skipped";
    }
    await markFailure(row._id, row.attempts, new Error(errors.join("; ")));
    return "failed";
  } catch (err) {
    await markFailure(row._id, row.attempts, err);
    return "failed";
  }
};

const drainOnce = async () => {
  if (draining) return { sent: 0, skipped: 0, failed: 0 };
  draining = true;
  const tally = { sent: 0, skipped: 0, failed: 0 };
  try {
    const due = await pushRepository.findDueIds(BATCH_SIZE);
    for (const { _id } of due) {
      const row = await pushRepository.claimRow(_id);
      if (!row) continue;
      try {
        tally[await deliver(row)] += 1;
      } catch (err) {
        await markFailure(_id, row.attempts, err);
        tally.failed += 1;
      }
    }
  } catch (err) {
    console.error("[push] dispatcher pass failed:", err.message);
  } finally {
    draining = false;
  }
  if (tally.sent || tally.failed) {
    console.log(`[push] dispatched — sent ${tally.sent}, skipped ${tally.skipped}, failed ${tally.failed}`);
  }
  return tally;
};

const kick = (delayMs = 1000) => {
  if (kickTimer || draining) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    drainOnce();
  }, delayMs);
  if (kickTimer.unref) kickTimer.unref();
};

const startPushDispatcher = () => {
  if (timer) return;
  console.log(`[push] dispatcher starting — transport: ${transport.transportKind()}`);
  setTimeout(() => {
    drainOnce();
    timer = setInterval(drainOnce, INTERVAL_MS);
    if (timer.unref) timer.unref();
  }, INITIAL_DELAY_MS);
};

const stopPushDispatcher = () => {
  if (timer) clearInterval(timer);
  if (kickTimer) clearTimeout(kickTimer);
  timer = null;
  kickTimer = null;
};

module.exports = { startPushDispatcher, stopPushDispatcher, drainOnce, kick };
