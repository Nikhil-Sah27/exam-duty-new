const catchAsync = require("../../shared/utils/catchAsync");
const pushService = require("./push.service");

const register = catchAsync(async (req, res) => {
  const data = await pushService.registerDevice(req.user.id, req.body);
  res.status(200).json({ success: true, data });
});

const unregister = catchAsync(async (req, res) => {
  const data = await pushService.unregisterDevice(req.user.id, req.body?.token || req.query.token);
  res.status(200).json({ success: true, data });
});

/** The caller's own recent push deliveries — "did my phone get told?" */
const myDeliveries = catchAsync(async (req, res) => {
  const data = await pushService.listForRecipient(req.user.id, 30);
  res.status(200).json({ success: true, count: data.length, data });
});

module.exports = { register, unregister, myDeliveries };
