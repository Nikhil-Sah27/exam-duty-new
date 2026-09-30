/**
 * Enqueue side of the mail system. Callers never send directly — they write an
 * outbox row (inside the caller's transaction, when there is one) and
 * `mail.dispatcher.js` delivers it afterwards.
 *
 * Nothing in this file is allowed to throw into its caller: an email problem
 * must never fail a duty assignment. Every path logs and returns null instead.
 */
const EmailOutbox = require("./emailOutbox.model");
const policy = require("./mail.policy");
const transport = require("./mail.transport");

/** Shape one outbox document from a notification's ingredients. */
const buildRow = ({ notification, type, recipient, title, message, data, dedupeKey }) => ({
  recipient,
  notification: notification?._id || notification || null,
  type,
  title,
  message,
  data: data || {},
  dedupeKey: dedupeKey || null,
  status: "pending",
  nextAttemptAt: new Date(),
});

/**
 * Queue an email for one notification. Returns the row, or null when the type's
 * policy says in-app only, when mail is disabled, or on any failure.
 *
 * Pass the caller's `session` so the row commits (or rolls back) with the
 * notification it mirrors.
 */
const enqueueForNotification = async (entry, session = null) => {
  try {
    if (!transport.isEnabled()) return null;
    if (!entry?.recipient || !entry?.type) return null;
    if (!policy.shouldEnqueue(entry.type)) return null;

    const doc = buildRow(entry);
    if (session) {
      const created = await EmailOutbox.create([doc], { session });
      return created[0];
    }
    return await EmailOutbox.create(doc);
  } catch (err) {
    // Swallow: the in-app notification already succeeded, and losing an email
    // must not turn a successful duty assignment into a 500.
    console.error(`[mail] failed to enqueue ${entry?.type} email:`, err.message);
    return null;
  }
};

/**
 * Batch version for `emitToMany` / `bulkEmit`. `entries` is a heterogeneous
 * list; each is filtered through the policy independently.
 */
const enqueueManyForNotifications = async (entries, session = null) => {
  try {
    if (!transport.isEnabled()) return [];
    const rows = (entries || [])
      .filter((e) => e?.recipient && e?.type && policy.shouldEnqueue(e.type))
      .map(buildRow);
    if (rows.length === 0) return [];
    return await EmailOutbox.insertMany(rows, session ? { session } : {});
  } catch (err) {
    console.error("[mail] failed to enqueue batch emails:", err.message);
    return [];
  }
};

/** Delivery counts by status — for the CS delivery log and ops scripts. */
const stats = async () => {
  const rows = await EmailOutbox.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return rows.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
};

/** Recent delivery attempts for one user, newest first. */
const listForRecipient = (recipientId, limit = 50) =>
  EmailOutbox.find({ recipient: recipientId }).sort({ createdAt: -1 }).limit(limit);

module.exports = {
  enqueueForNotification,
  enqueueManyForNotifications,
  stats,
  listForRecipient,
};
