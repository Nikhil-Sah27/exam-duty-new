// Public API for sending notifications from other modules.
// Other modules import ONLY from this file — never from service or repository.

const notificationRepository = require("./notification.repository");
const templates = require("./notification.templates");

const emit = async (
  type,
  { recipient, refModel, refId, data = {}, dedupeKey, session } = {},
) => {
  const { title, message } = templates[type](data);

  return notificationRepository.create(
    {
      recipient,
      type,
      title,
      message,
      refModel: refModel || null,
      refId: refId || null,
      dedupeKey: dedupeKey || null,
    },
    session,
  );
};

/**
 * Emit only if no notification with this `dedupeKey` already exists — used by
 * the daily sweeps so a re-run (or a nodemon restart) never double-notifies.
 * The unique sparse index on `dedupeKey` is the ultimate guard; the pre-check
 * just avoids noisy duplicate-key errors on the common path.
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
  { recipients, refModel, refId, data = {}, session } = {},
) => {
  const { title, message } = templates[type](data);

  const docs = recipients.map((recipient) => ({
    recipient,
    type,
    title,
    message,
    refModel: refModel || null,
    refId: refId || null,
  }));

  return notificationRepository.createMany(docs, session);
};

/**
 * Bulk-emit a heterogeneous batch where each notification has its own
 * `type`, `recipient`, refs, and `data`. The template is resolved per-entry
 * before all docs are written in a single `insertMany`. Used by cascade
 * cleanup flows where every affected teacher gets a per-duty message.
 */
const bulkEmit = async (notifications, { session } = {}) => {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const docs = notifications.map(({ type, recipient, refModel, refId, data = {} }) => {
    const { title, message } = templates[type](data);
    return {
      recipient,
      type,
      title,
      message,
      refModel: refModel || null,
      refId: refId || null,
    };
  });

  return notificationRepository.createMany(docs, session);
};

module.exports = { emit, emitToMany, bulkEmit, emitIfAbsent };
