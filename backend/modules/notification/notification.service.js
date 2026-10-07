const AppError = require("../../shared/utils/AppError");
const notificationRepository = require("./notification.repository");

// User-facing CRUD only. For sending notifications, use notification.emitter.js.

// Operational roles get a role-scoped inbox: a multi-role teacher (e.g. an
// Associate Professor who is both RS and invigilator) sees only the messages
// for the role they're currently in, plus role-agnostic ones (role: null —
// exam announcements, broadcasts). CS is single-role and every CS-facing alert
// is role-agnostic, so CS sees everything unscoped. `{ role: null }` also
// matches legacy rows written before this field existed.
const OPERATIONAL_ROLES = new Set(["invigilator", "rs", "dcs"]);

const roleScopeFilter = (activeRole) =>
  OPERATIONAL_ROLES.has(activeRole)
    ? { $or: [{ role: activeRole }, { role: null }] }
    : {};

const getMyNotifications = async (userId, query, activeRole) => {
  const filter = { ...roleScopeFilter(activeRole) };
  if (query.unread === "true") filter.isRead = false;
  return notificationRepository.findByRecipient(userId, filter);
};

const getUnreadCount = async (userId, activeRole) => {
  const count = await notificationRepository.countUnread(userId, roleScopeFilter(activeRole));
  return { count };
};

const markAsRead = async (id, userId) => {
  const notification = await notificationRepository.findById(id);
  if (!notification) throw new AppError("Notification not found", 404);

  if (notification.recipient.toString() !== userId) {
    throw new AppError("Not authorized to mark this notification", 403);
  }

  return notificationRepository.markAsRead(id);
};

const markAllAsRead = async (userId) => {
  return notificationRepository.markAllAsRead(userId);
};

// Ownership-checked delete. 404 on missing wins over 403 on wrong-owner so
// we don't leak the existence of another user's notification.
const deleteNotification = async (id, userId) => {
  const notification = await notificationRepository.findById(id);
  if (!notification) throw new AppError("Notification not found", 404);

  if (notification.recipient.toString() !== userId) {
    throw new AppError("Not authorized to delete this notification", 403);
  }

  await notificationRepository.deleteById(id);
  return { deleted: 1 };
};

// Repository filter is recipient-scoped, so this can never delete another
// user's notifications regardless of caller intent.
const deleteAllNotifications = async (userId) => {
  const result = await notificationRepository.deleteAllByRecipient(userId);
  return { deleted: result.deletedCount ?? 0 };
};

const NUDGE_TYPES = ["duty_confirm_nudge", "duty_selection_nudge"];

/** How many confirm / select-duty nudges each teacher got since `since`. */
const countNudgesByRecipient = (since) => notificationRepository.countByRecipientForTypes(NUDGE_TYPES, since);

/** How many select-duty nudges each teacher got in [since, before). */
const countSelectionNudgesBefore = (since, before) =>
  notificationRepository.countByRecipientForTypes(["duty_selection_nudge"], since, before);

module.exports = {
  countNudgesByRecipient,
  countSelectionNudgesBefore,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
