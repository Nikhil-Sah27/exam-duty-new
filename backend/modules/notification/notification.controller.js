const notificationService = require("./notification.service");
const catchAsync = require("../../shared/utils/catchAsync");

const getMine = catchAsync(async (req, res) => {
  const notifications = await notificationService.getMyNotifications(
    req.user.id, req.query, req.user.activeRole
  );
  res.status(200).json({ success: true, count: notifications.length, data: notifications });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user.id, req.user.activeRole);
  res.status(200).json({ success: true, data: result });
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.params.id, req.user.id
  );
  res.status(200).json({ success: true, data: notification });
});

const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.status(200).json({ success: true, message: "All notifications marked as read" });
});

const remove = catchAsync(async (req, res) => {
  const result = await notificationService.deleteNotification(
    req.params.id, req.user.id
  );
  res.status(200).json({ success: true, ...result });
});

const removeAll = catchAsync(async (req, res) => {
  const result = await notificationService.deleteAllNotifications(req.user.id);
  res.status(200).json({ success: true, ...result });
});

module.exports = {
  getMine,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  remove,
  removeAll,
};
