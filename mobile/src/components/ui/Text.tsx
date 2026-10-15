import { Text as RNText, type TextProps } from "react-native";

import { useTheme } from "@/theme";

type Variant = "title" | "heading" | "subheading" | "body" | "label" | "caption";

const SIZES: Record<Variant, { fontSize: number; fontWeight: "400" | "500" | "600" | "700" | "800"; lineHeight: number }> = {
  title: { fontSize: 28, fontWeight: "800", lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  subheading: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
};

export function Text({
  variant = "body",
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[SIZES[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]}
    />
  );
}
