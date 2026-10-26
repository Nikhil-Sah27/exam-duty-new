import { StyleSheet, View } from "react-native";

import { Icon, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

/** A chat's header: round avatar icon, name, one-line subtitle (both sides' chats). */
export function ChatHeaderTitle({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.headerTitle}>
      <View style={[styles.avatar, { backgroundColor: colors.primaryDeep }]}>
        <Icon name={icon} size={18} color={colors.onPrimary} />
        <View style={[styles.onlineDot, { borderColor: colors.surface }]} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 260 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, backgroundColor: "#34d399" },
});
