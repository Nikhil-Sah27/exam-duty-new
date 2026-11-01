import { router } from "expo-router";
import { View } from "react-native";

import { Banner, Button, Text } from "@/components/ui";
import { formatExamDate } from "@/lib/format";
import { useTheme } from "@/theme";

import { useAdLevel, useAdStatus } from "./hooks";
import type { AdReason } from "./types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Why this teacher sees extra ads, and how to stop them. Shown on Home from
 * level 2 — the base banner (level 1) needs no explanation.
 */
export function AdReasonStrip() {
  const level = useAdLevel();
  const reasons = useAdStatus().data?.reasons ?? [];
  if (level < 2 || reasons.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {reasons.map((r) => (
        <ReasonBanner key={r.code} reason={r} />
      ))}
    </View>
  );
}

function ReasonBanner({ reason }: { reason: AdReason }) {
  const { colors } = useTheme();
  if (reason.code === "behind") {
    return (
      <Banner tone="warning" title={`Select ${plural(reason.remaining, "more duty", "more duties")} to remove the extra ads`}>
        <Text variant="caption" color={colors.warning}>
          {`You've been behind on picking duties for ${plural(reason.days, "day", "days")}. Ads increase each day.`}
        </Text>
        <Button title="Select duties" icon="select" onPress={() => router.navigate("/select")} style={{ alignSelf: "flex-start", marginTop: 6 }} />
      </Banner>
    );
  }
  return (
    <Banner tone="danger" title={`Marked absent on ${formatExamDate(reason.date)}`}>
      <Text variant="caption" color={colors.danger}>
        {`Extra ads until ${formatExamDate(reason.until)}. If this is a mistake, message the exam cell.`}
      </Text>
      <Button title="Message the exam cell" icon="chat" variant="secondary" onPress={() => router.navigate("/messages")} style={{ alignSelf: "flex-start", marginTop: 6 }} />
    </Banner>
  );
}
