import * as Updates from "expo-updates";
import { TestIds } from "react-native-google-mobile-ads";

/**
 * Which AdMob ad units this build shows.
 *
 * Only the Play Store build (EAS channel "production") uses the real units.
 * Development and preview builds always get Google's test ads, so nobody on
 * the team taps our own live ads — AdMob bans accounts for that. The channel
 * is baked into each build, so an over-the-air update can't change it.
 *
 * The real units belong to the Proctavo app in AdMob (App ID in app.json,
 * publisher pub-2753291183102591, also in proctavo.com/app-ads.txt). Ad unit
 * IDs aren't secret.
 */
const LIVE_UNITS: { banner: string | null; interstitial: string | null } = {
  banner: "ca-app-pub-2753291183102591/8077204984",
  interstitial: "ca-app-pub-2753291183102591/3900167157",
};

const TEST_UNITS = { banner: TestIds.BANNER, interstitial: TestIds.INTERSTITIAL };

export const AD_UNITS = Updates.channel === "production" ? LIVE_UNITS : TEST_UNITS;
