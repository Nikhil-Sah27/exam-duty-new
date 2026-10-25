import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { useUnreadCount } from "./hooks";

/**
 * The way into Alerts: a bell with the unread count, at the top right of every
 * tab (the bottom bar's slot went to Messages). Opens the /alerts stack screen,
 * which is also where a tapped push without a duty lands.
 */
export function AlertsBell() {
  const { colors } = useTheme();
  const { data: unread = 0 } = useUnreadCount();
  const label = unread > 99 ? "99+" : String(unread);

  return (
    <Pressable
      onPress={() => router.push("/alerts")}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
      hitSlop={10}
      style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="alerts" size={24} color={colors.text} />
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: "700" },
});
