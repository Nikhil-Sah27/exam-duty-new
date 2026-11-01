import mobileAds, { AdsConsent, MaxAdContentRating } from "react-native-google-mobile-ads";

let starting: Promise<boolean> | null = null;

/**
 * Start the ad SDK once per app run. Google's consent form comes first (it only
 * appears where the law asks for it, such as the EEA and UK), then the request
 * settings, then initialize. Resolves false when ads can't be requested.
 *
 * Called only once a teacher's ad level is 1 or more, so the SDK never starts
 * for a college with ads off, or for CS (app.json delays its measurement until
 * this runs).
 */
export function startAds(): Promise<boolean> {
  starting ??= (async () => {
    try {
      const consent = await AdsConsent.gatherConsent();
      if (!consent.canRequestAds) return false;
      // A staff tool: keep ads suitable for a general audience at work.
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
      await mobileAds().initialize();
      return true;
    } catch {
      starting = null; // offline or a consent hiccup: try again next time
      return false;
    }
  })();
  return starting;
}
