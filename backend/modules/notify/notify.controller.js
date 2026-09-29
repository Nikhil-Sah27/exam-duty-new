const notifyService = require("./notify.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const send = catchAsync(async (req, res) => {
  const result = await notifyService.sendBroadcast(req.body, req.user.id);
  auditService.logSafe({
    action: "SEND_BROADCAST",
    entity: "Notification",
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      audience: req.body?.audience,
      roles: req.body?.roles,
      title: req.body?.title,
      sent: result.sent,
    },
  });
  res.status(201).json({ success: true, ...result });
});

module.exports = { send };
