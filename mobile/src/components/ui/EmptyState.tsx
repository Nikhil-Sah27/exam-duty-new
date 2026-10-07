import type { ReactNode } from "react";
import { View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/theme";

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 16 }}>
      <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 16 }}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text variant="subheading" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {message ? (
        <Text muted style={{ textAlign: "center" }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 8, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}
