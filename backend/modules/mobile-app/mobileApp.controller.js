const catchAsync = require("../../shared/utils/catchAsync");
const AppError = require("../../shared/utils/AppError");
const mobileAppService = require("./mobileApp.service");

const getInfo = catchAsync(async (req, res) => {
  const android = await mobileAppService.getAndroidRelease();
  res.status(200).json({ success: true, data: { android } });
});

const downloadAndroid = catchAsync(async (req, res) => {
  const release = await mobileAppService.getAndroidRelease();
  if (!release.available) {
    throw new AppError("The Android app isn't available for download yet", 404);
  }
  // Streams with Range/ETag support; the .apk name sets the Android package MIME type.
  res.download(mobileAppService.androidApkPath(), "Proctavo.apk");
});

module.exports = { getInfo, downloadAndroid };
