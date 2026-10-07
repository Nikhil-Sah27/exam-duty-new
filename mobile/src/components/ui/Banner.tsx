import type { ReactNode } from "react";
import { View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/theme";

type Tone = "info" | "success" | "warning" | "danger";

export function Banner({ tone = "info", icon, title, children }: { tone?: Tone; icon?: IconName; title: string; children?: ReactNode }) {
  const { colors, radius } = useTheme();
  const tones: Record<Tone, { fg: string; bg: string; icon: IconName }> = {
    info: { fg: colors.info, bg: colors.infoBg, icon: "info" },
    success: { fg: colors.success, bg: colors.successBg, icon: "check" },
    warning: { fg: colors.warning, bg: colors.warningBg, icon: "warning" },
    danger: { fg: colors.danger, bg: colors.dangerBg, icon: "error" },
  };
  const t = tones[tone];
  return (
    <View style={{ flexDirection: "row", gap: 12, backgroundColor: t.bg, borderRadius: radius.md, padding: 14, alignItems: "flex-start" }}>
      <Icon name={icon ?? t.icon} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" color={t.fg}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}
