const fs = require("fs/promises");
const os = require("os");
const path = require("path");

// The Android APK lives on the server, outside the repo: a ~100 MB binary
// doesn't belong in git (GitHub rejects files over 100 MB) and deploys never
// touch this folder. Publishing a new build is an scp — see mobile/README.md.
const APP_DIR = process.env.MOBILE_APP_DIR || path.join(os.homedir(), "proctavo-app");
const ANDROID_APK = path.join(APP_DIR, "proctavo.apk");
// Optional sidecar written next to the APK: { "version": "1.0.0" }.
const ANDROID_META = path.join(APP_DIR, "proctavo.json");

const androidApkPath = () => ANDROID_APK;

const readMeta = async () => {
  try {
    return JSON.parse(await fs.readFile(ANDROID_META, "utf8"));
  } catch {
    return {};
  }
};

/** What the download page shows. Unavailable until an APK has been uploaded. */
const getAndroidRelease = async () => {
  const stat = await fs.stat(ANDROID_APK).catch(() => null);
  if (!stat || !stat.isFile()) return { available: false };

  const meta = await readMeta();
  return {
    available: true,
    version: meta.version || null,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
};

module.exports = { androidApkPath, getAndroidRelease };
