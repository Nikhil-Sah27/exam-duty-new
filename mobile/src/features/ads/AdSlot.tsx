import { useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { Text } from "@/components/ui";

import { AD_UNITS } from "./adUnits";
import { useAdLevel } from "./hooks";
import type { AdLevel } from "./types";

/**
 * A small banner that appears once the teacher's ad level reaches `minLevel`
 * (types.ts lists which screen gets which). Labelled as an ad and spaced away
 * from buttons so it isn't tapped by accident; disappears if nothing fills it.
 */
export function AdSlot({ minLevel }: { minLevel: Exclude<AdLevel, 0> }) {
  const level = useAdLevel();
  const [failed, setFailed] = useState(false);
  if (level < minLevel || !AD_UNITS.banner || failed) return null;

  return (
    <View style={{ alignItems: "center", gap: 4, marginVertical: 12 }}>
      <Text variant="caption" muted>
        Advertisement
      </Text>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.BANNER}
        onAdFailedToLoad={(err) => {
          console.warn("[ads] banner failed:", err.code ?? "", err.message);
          setFailed(true);
        }}
      />
    </View>
  );
}
