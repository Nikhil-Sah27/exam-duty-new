const catchAsync = require("../../shared/utils/catchAsync");
const adsService = require("./ads.service");

/** The signed-in teacher's ad level and the reasons for it. */
const status = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: await adsService.getStatus(req.user) });
});

/** Superadmin: the platform-wide master switch. */
const getSettings = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: await adsService.getPlatformSettings() });
});

const updateSettings = catchAsync(async (req, res) => {
  const data = await adsService.setPlatformAdsEnabled(req.body?.adsEnabled, req.user);
  res.status(200).json({ success: true, data });
});

module.exports = { status, getSettings, updateSettings };
