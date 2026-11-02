import mobileAds, { AdsConsent, AdsConsentStatus, MaxAdContentRating } from "react-native-google-mobile-ads";

let starting: Promise<boolean> | null = null;

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Start the ad SDK once per app run. Google's consent form comes first (it only
 * appears where the law asks for it, such as the EEA and UK), then the request
 * settings, then initialize. Resolves false when ads can't be requested.
 *
 * A failed consent check doesn't block ads on its own: the app is released in
 * India, where no consent form is required, and the check also fails for
 * reasons that say nothing about the user (offline, or no consent message set
 * up in AdMob). Only a known "consent required but not given" stops them.
 *
 * Called only once a teacher's ad level is 1 or more, so the SDK never starts
 * for a college with ads off, or for CS (app.json delays its measurement until
 * this runs). Failures are logged with an "[ads]" prefix for `adb logcat`.
 */
export function startAds(): Promise<boolean> {
  starting ??= (async () => {
    try {
      await AdsConsent.gatherConsent();
    } catch (err) {
      console.warn("[ads] consent check failed:", why(err));
    }
    try {
      const consent = await AdsConsent.getConsentInfo();
      if (!consent.canRequestAds && consent.status !== AdsConsentStatus.UNKNOWN) {
        console.warn("[ads] consent not given:", consent.status);
        return false;
      }
      // A staff tool: keep ads suitable for a general audience at work.
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
      await mobileAds().initialize();
      return true;
    } catch (err) {
      console.warn("[ads] SDK start failed:", why(err));
      starting = null; // try again next time
      return false;
    }
  })();
  return starting;
}
