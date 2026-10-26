import { View } from "react-native";

import { Text } from "@/components/ui";
import { radius, useTheme } from "@/theme";

/** A tinted number tile: big value, small label (dashboard counts). */
export function StatTile({ label, value, fg, bg }: { label: string; value: number; fg: string; bg: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2, padding: 12, borderRadius: radius.md, backgroundColor: bg }}>
      <Text variant="title" color={fg}>
        {value}
      </Text>
      <Text variant="caption" color={colors.text}>
        {label}
      </Text>
    </View>
  );
}
