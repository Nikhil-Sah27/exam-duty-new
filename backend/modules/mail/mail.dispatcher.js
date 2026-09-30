/**
 * Delivery side of the mail system: drains `EmailOutbox` and sends.
 *
 * Runs out-of-band on a short interval rather than on the request path, which
 * is what makes the outbox worth having — see emailOutbox.model.js. A row
 * enqueued inside an open transaction is simply invisible to the claim query
 * until that transaction commits, so a rolled-back assignment silently takes
 * its email with it.
 */
const EmailOutbox = require("./emailOutbox.model");
const User = require("../auth/auth.model");
const policy = require("./mail.policy");
const transport = require("./mail.transport");
const { renderEmail } = require("./mail.templates");
const { buildIcs, parseAddress } = require("../calendar/calendar.ics");

// Lazy: duty.service → notification emitter → this file.
const dutyService = () => require("../duty/duty.service");

// Emails about a duty the teacher may still need to confirm.
const CONFIRMABLE = new Set([
  "duty_assigned",
  "duty_group_assigned",
  "duty_swapped",
  "duty_reminder",
  "duty_confirm_nudge",
  "calendar_request",
]);

const confirmLinksFor = async (row) => {
  if (!CONFIRMABLE.has(row.type) || !row.data?.refDutyId) return null;
  try {
    return await dutyService().confirmLinksForDuty(row.data.refDutyId);
  } catch {
    return null; // a missing button must never block the email
  }
};

const INTERVAL_MS = 20 * 1000;
const INITIAL_DELAY_MS = 8 * 1000; // let the server settle, like the notification scheduler
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
// Backoff per attempt number (1-indexed): 1m, 5m, 15m, 1h, then give up.
const BACKOFF_MINUTES = [1, 5, 15, 60];

let timer = null;
let kickTimer = null;
let draining = false;

const backoffFor = (attempts) => {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] || 60;
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Recipient lookup that can see deactivated users. `User` has a pre-find hook
 * hiding `isActive: false`, so an explicit filter is required — otherwise a
 * deactivated teacher looks like a deleted one and we'd log the wrong reason.
 */
const findRecipient = (id) =>
  User.findOne({ _id: id, isActive: { $in: [true, false] } })
    .select("name email isActive notificationPrefs")
    .lean();

/**
 * Atomically take ownership of one pending row. The status guard means two
 * dispatchers (or a restart mid-send) can never send the same row twice.
 */
const claimRow = (id) =>
  EmailOutbox.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "processing" }, $inc: { attempts: 1 } },
    { new: true }
  );

const markSent = (id, messageId) =>
  EmailOutbox.findByIdAndUpdate(id, {
    status: "sent",
    sentAt: new Date(),
    messageId: messageId || null,
    lastError: null,
  });

const markSkipped = (id, reason) =>
  EmailOutbox.findByIdAndUpdate(id, { status: "skipped", skipReason: reason });

const markFailure = (id, attempts, err) => {
  const givingUp = attempts >= MAX_ATTEMPTS;
  return EmailOutbox.findByIdAndUpdate(id, {
    status: givingUp ? "failed" : "pending",
    lastError: String(err?.message || err).slice(0, 500),
    ...(givingUp ? {} : { nextAttemptAt: backoffFor(attempts) }),
  });
};

/** Process one claimed row. Returns "sent" | "skipped" | "failed". */
const deliver = async (row) => {
  const user = await findRecipient(row.recipient);
  const block = policy.blockReasonForUser(user, row.type);
  if (block) {
    await markSkipped(row._id, block);
    return "skipped";
  }

  const links = await confirmLinksFor(row);
  const { subject, html, text } = renderEmail({
    type: row.type,
    title: row.title,
    message: row.message,
    data: { ...(row.data || {}), ...(links || {}) },
    recipientName: user.name,
  });

  // Calendar rows carry the event; the .ics is built here so it names the
  // recipient's current address.
  const cal = row.data?.calendar;
  const icalEvent = cal
    ? {
        method: cal.method.toLowerCase(),
        filename: cal.method === "CANCEL" ? "cancel.ics" : "invite.ics",
        content: buildIcs({
          ...cal,
          start: new Date(cal.start),
          end: new Date(cal.end),
          organizer: parseAddress(transport.fromAddress()),
          attendee: { name: user.name, email: user.email },
        }),
      }
    : undefined;

  try {
    const { messageId } = await transport.send({ to: user.email, subject, html, text, icalEvent });
    await markSent(row._id, messageId);
    return "sent";
  } catch (err) {
    await markFailure(row._id, row.attempts, err);
    return "failed";
  }
};

/**
 * One drain pass. Safe to call concurrently — overlapping calls return early
 * rather than double-sending.
 */
const drainOnce = async () => {
  if (draining) return { sent: 0, skipped: 0, failed: 0 };
  draining = true;
  const tally = { sent: 0, skipped: 0, failed: 0 };
  try {
    const due = await EmailOutbox.find({
      status: "pending",
      nextAttemptAt: { $lte: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .select("_id");

    for (const { _id } of due) {
      const row = await claimRow(_id);
      if (!row) continue; // claimed by someone else
      try {
        tally[await deliver(row)] += 1;
      } catch (err) {
        // deliver() handles its own send errors; this catches lookup/render bugs.
        await markFailure(_id, row.attempts, err);
        tally.failed += 1;
      }
    }
  } catch (err) {
    console.error("[mail] dispatcher pass failed:", err.message);
  } finally {
    draining = false;
  }

  if (tally.sent || tally.failed || tally.skipped) {
    console.log(
      `[mail] dispatched — sent ${tally.sent}, skipped ${tally.skipped}, failed ${tally.failed}`
    );
  }
  return tally;
};

/**
 * Ask for a drain shortly (default 1s). Called after a non-transactional emit so
 * ordinary notifications don't wait for the next tick. Coalesced, so a burst of
 * emits produces one pass.
 */
const kick = (delayMs = 1000) => {
  if (kickTimer || draining) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    drainOnce();
  }, delayMs);
  if (kickTimer.unref) kickTimer.unref();
};

const startMailDispatcher = () => {
  if (timer) return; // guard against double-start within a process
  console.log(`[mail] dispatcher starting — transport: ${transport.transportKind()}`);
  setTimeout(() => {
    drainOnce();
    timer = setInterval(drainOnce, INTERVAL_MS);
    if (timer.unref) timer.unref();
  }, INITIAL_DELAY_MS);
};

const stopMailDispatcher = () => {
  if (timer) clearInterval(timer);
  if (kickTimer) clearTimeout(kickTimer);
  timer = null;
  kickTimer = null;
};

module.exports = { startMailDispatcher, stopMailDispatcher, drainOnce, kick };
