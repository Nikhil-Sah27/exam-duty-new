import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, size = "md", style }: ButtonProps) {
  const { colors, radius } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primaryDeep, fg: colors.onPrimary, border: colors.primaryDeep },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
    success: { bg: colors.success, fg: "#ffffff", border: colors.success },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
  };
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderRadius: radius.md,
          minHeight: size === "lg" ? 52 : 44,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={p.fg} /> : null}
          <Text variant={size === "lg" ? "subheading" : "label"} color={p.fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
