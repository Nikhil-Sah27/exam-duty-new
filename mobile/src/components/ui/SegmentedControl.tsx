import { Pressable, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** A row of mutually exclusive tabs (e.g. Pending / Approved / Rejected). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", padding: 3, gap: 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <Text variant="caption" color={active ? colors.text : colors.textMuted} style={{ fontWeight: active ? "700" : "500" }}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
