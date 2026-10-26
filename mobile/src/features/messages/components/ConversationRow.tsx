import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

import type { Conversation, ConversationTeacher } from "../api";
import { formatMessageTime, initials } from "../format";

export const teacherOf = (c: Conversation): ConversationTeacher | null =>
  c.teacher && typeof c.teacher === "object" ? c.teacher : null;

/**
 * One row of the CS inbox (port of the web ConversationList item): avatar
 * initials, teacher, last message ("You: …" when CS wrote last), time, and an
 * unread count from that teacher.
 */
export function ConversationRow({ conversation: c, onPress }: { conversation: Conversation; onPress: () => void }) {
  const { colors } = useTheme();
  const teacher = teacherOf(c);
  const name = teacher?.name ?? "Teacher";
  const unread = c.csUnread > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}${unread ? `, ${c.csUnread} unread` : ""}`}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primaryDeep }]}>
        <Text variant="label" color={colors.onPrimary}>
          {initials(name)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.line}>
          <Text variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: unread ? "700" : "600" }}>
            {name}
          </Text>
          <Text variant="caption" color={unread ? colors.primary : colors.textMuted}>
            {formatMessageTime(c.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {c.lastMessageBody ? `${c.lastSenderIsCs ? "You: " : ""}${c.lastMessageBody}` : teacher?.department || "No messages yet"}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text variant="caption" color={colors.onPrimary} style={{ fontWeight: "700", fontSize: 11 }}>
                {c.csUnread > 99 ? "99+" : c.csUnread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
});
