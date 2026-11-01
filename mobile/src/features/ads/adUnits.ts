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
 * The real IDs come from the AdMob account at go-live (ADS_PLAN.md step 4,
 * together with the real App ID in app.json). They aren't secret. Until they're
 * set, the production build shows no ads at all.
 */
const LIVE_UNITS: { banner: string | null; interstitial: string | null } = {
  banner: null,
  interstitial: null,
};

const TEST_UNITS = { banner: TestIds.BANNER, interstitial: TestIds.INTERSTITIAL };

export const AD_UNITS = Updates.channel === "production" ? LIVE_UNITS : TEST_UNITS;
