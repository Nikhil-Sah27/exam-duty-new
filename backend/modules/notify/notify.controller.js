const notifyService = require("./notify.service");
const catchAsync = require("../../shared/utils/catchAsync");

const send = catchAsync(async (req, res) => {
  const result = await notifyService.sendBroadcast(req.body, req.user.id);
  res.status(201).json({ success: true, ...result });
});

module.exports = { send };
