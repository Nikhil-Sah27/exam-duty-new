import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { useMyUnits } from "@/features/duties/hooks";

import { AD_UNITS } from "./adUnits";
import { useAdLevel } from "./hooks";
import { localDay, mayShowInterstitial } from "./interstitialRule";

const SHOWN_DAY_KEY = "ads.interstitial.lastShownDay.v1";

/**
 * Level 4's one full-screen ad a day. Mount on Home only: it shows when the
 * teacher comes back to Home from another screen — a natural pause — never on
 * the first visit after launch, never near a duty (interstitialRule).
 */
export function useDailyInterstitial() {
  const level = useAdLevel();
  const units = useMyUnits();
  const ad = useInterstitialAd({ adUnitId: level >= 4 ? AD_UNITS.interstitial : null });

  // The focus handler reads the latest values without re-running on every
  // change — re-running while Home is open would pop the ad mid-read.
  const latest = useRef({ status: ad.status, show: ad.show, units: units.data ?? [] });
  useEffect(() => {
    latest.current = { status: ad.status, show: ad.show, units: units.data ?? [] };
  });

  const seenHome = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!seenHome.current) {
        seenHome.current = true; // launch, or the first visit: never
        return;
      }
      const { status, show, units: list } = latest.current;
      if (status !== "loaded") return;
      void (async () => {
        const now = new Date();
        const lastShownDay = await AsyncStorage.getItem(SHOWN_DAY_KEY);
        if (!mayShowInterstitial({ lastShownDay, units: list, now })) return;
        await AsyncStorage.setItem(SHOWN_DAY_KEY, localDay(now));
        show();
      })();
    }, []),
  );
}
