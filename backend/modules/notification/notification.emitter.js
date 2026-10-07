// Public API for sending notifications from other modules.
// Other modules import ONLY from this file — never from service or repository.
//
// This is also where email fan-out happens. Because every notification in the
// app is created through one of the four functions below, hooking the mail
// outbox in here gives EVERY type — including ones added later — an email
// channel without touching a single call site. Per-type opt-out lives in
// modules/mail/mail.policy.js.
//
// Two rules the mail hookup must never break:
//   1. The outbox row is written with the caller's `session`, so a rolled-back
//      transaction takes its emails with it (no email about a duty that was
//      never created).
//   2. Mail failures are swallowed. A notification that was successfully
//      written must not turn into a failed request because SMTP is down.

const notificationRepository = require("./notification.repository");
const templates = require("./notification.templates");
const mailService = require("../mail/mail.service");
const mailDispatcher = require("../mail/mail.dispatcher");
const calendarSync = require("../calendar/calendar.sync");

// Notifications that mean the recipient's duties just changed — their calendar
// gets reconciled a few seconds later (after any transaction has committed).
// The sync is state-based, so an over-eager trigger costs a no-op, never a
// duplicate invite.
const CALENDAR_TRIGGERS = new Set([
  "duty_assigned",
  "duty_group_assigned",
  "duty_self_claimed",
  "duty_cancelled",
  "duty_group_cancelled",
  "duty_swapped",
  "exam_updated",
  "exam_deleted_duty_release",
  "request_approved",
]);

// The duty an email is about, so the dispatcher can add a "Confirm I'll be
// there" button at send time.
const withDutyRef = (data, refModel, refId) =>
  refModel === "Duty" && refId ? { ...data, refDutyId: String(refId) } : data;

const touchCalendar = (type, recipient) => {
  if (CALENDAR_TRIGGERS.has(type)) calendarSync.markDirty(recipient);
};

/**
 * Queue the email mirroring a just-written notification. Outside a transaction
 * the row is immediately visible, so nudge the dispatcher rather than waiting
 * up to its poll interval; inside one, the periodic pass picks it up after
 * commit (it cannot see uncommitted rows).
 */
const queueEmail = async (entry, session) => {
  await mailService.enqueueForNotification(entry, session);
  if (!session) mailDispatcher.kick();
};

const queueEmails = async (entries, session) => {
  await mailService.enqueueManyForNotifications(entries, session);
  if (!session) mailDispatcher.kick();
};

const emit = async (
  type,
  { recipient, role, refModel, refId, data = {}, dedupeKey, session } = {},
) => {
  const { title, message } = templates[type](data);

  const notification = await notificationRepository.create(
    {
      recipient,
      role: role || null,
      type,
      title,
      message,
      refModel: refModel || null,
      refId: refId || null,
      dedupeKey: dedupeKey || null,
    },
    session,
  );

  await queueEmail(
    { notification, type, recipient, title, message, data: withDutyRef(data, refModel, refId), dedupeKey },
    session,
  );
  touchCalendar(type, recipient);

  return notification;
};

/**
 * Emit only if no notification with this `dedupeKey` already exists — used by
 * the daily sweeps so a re-run (or a nodemon restart) never double-notifies.
 * The unique sparse index on `dedupeKey` is the ultimate guard; the pre-check
 * just avoids noisy duplicate-key errors on the common path.
 *
 * Email dedupe rides along for free: no notification written means no outbox
 * row, so a repeated sweep cannot re-send a reminder either.
 */
const emitIfAbsent = async (type, { dedupeKey, ...rest } = {}) => {
  if (!dedupeKey) return emit(type, rest);
  const exists = await notificationRepository.existsByDedupeKey(dedupeKey);
  if (exists) return null;
  try {
    return await emit(type, { ...rest, dedupeKey });
  } catch (err) {
    // Lost a race with a concurrent sweep — the row already exists, which is
    // exactly the desired end state.
    if (err && err.code === 11000) return null;
    throw err;
  }
};

const emitToMany = async (
  type,
  { recipients, role, refModel, refId, data = {}, session } = {},
) => {
  const { title, message } = templates[type](data);

  const docs = recipients.map((recipient) => ({
    recipient,
    role: role || null,
    type,
    title,
    message,
    refModel: refModel || null,
    refId: refId || null,
  }));

  const created = await notificationRepository.createMany(docs, session);

  await queueEmails(
    recipients.map((recipient) => ({
      type,
      recipient,
      title,
      message,
      data: withDutyRef(data, refModel, refId),
    })),
    session,
  );
  recipients.forEach((recipient) => touchCalendar(type, recipient));

  return created;
};

/**
 * Bulk-emit a heterogeneous batch where each notification has its own
 * `type`, `recipient`, refs, and `data`. The template is resolved per-entry
 * before all docs are written in a single `insertMany`. Used by cascade
 * cleanup flows where every affected teacher gets a per-duty message.
 */
const bulkEmit = async (notifications, { session } = {}) => {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const rendered = notifications.map(({ type, recipient, role, refModel, refId, data = {} }) => {
    const { title, message } = templates[type](data);
    return { type, recipient, role, refModel, refId, data, title, message };
  });

  const docs = rendered.map(({ type, recipient, role, refModel, refId, title, message }) => ({
    recipient,
    role: role || null,
    type,
    title,
    message,
    refModel: refModel || null,
    refId: refId || null,
  }));

  const created = await notificationRepository.createMany(docs, session);

  await queueEmails(
    rendered.map(({ type, recipient, refModel, refId, title, message, data }) => ({
      type,
      recipient,
      title,
      message,
      data: withDutyRef(data, refModel, refId),
    })),
    session,
  );
  rendered.forEach(({ type, recipient }) => touchCalendar(type, recipient));

  return created;
};

module.exports = { emit, emitToMany, bulkEmit, emitIfAbsent };
