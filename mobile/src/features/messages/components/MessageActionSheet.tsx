import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Divider, Icon, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

import type { ChatMessage } from "../api";
import { QUICK_REACTIONS, senderLabel } from "../format";

interface Props {
  message: ChatMessage | null;
  /** The viewer is CS — their own messages are the CS ones. */
  viewerIsCs: boolean;
  /** Own, non-deleted message → Edit and Delete are offered. */
  canModify: boolean;
  /** The viewer's current reaction on this message, highlighted in the row. */
  currentReaction: string | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function Action({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <Text variant="body" color={color} style={{ fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Long-press menu for a message — the phone equivalent of the web's hover
 * dropdown (MessageActions): quick reactions, then Reply / Copy / Edit / Delete.
 */
export function MessageActionSheet({ message, viewerIsCs, canModify, currentReaction, onClose, onReact, onReply, onCopy, onEdit, onDelete }: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close message actions" />
      {message ? (
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.preview}>
            <Text variant="caption" color={colors.primary} style={{ fontWeight: "700" }}>
              {message.senderIsCs === viewerIsCs ? "You" : senderLabel(message)}
            </Text>
            <Text variant="caption" muted numberOfLines={2}>
              {message.body}
            </Text>
          </View>

          <View style={[styles.reactions, { borderColor: colors.border }]}>
            {QUICK_REACTIONS.map((e) => {
              const active = currentReaction === e;
              return (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={active ? `Remove ${e} reaction` : `React ${e}`}
                  onPress={() => onReact(e)}
                  style={({ pressed }) => [
                    styles.reaction,
                    { borderRadius: radius.pill },
                    active && { backgroundColor: colors.surfaceMuted, borderColor: colors.primary, borderWidth: 1 },
                    pressed && { transform: [{ scale: 1.15 }] },
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{e}</Text>
                </Pressable>
              );
            })}
          </View>

          <Action icon="reply" label="Reply" onPress={onReply} />
          <Action icon="copy" label="Copy" onPress={onCopy} />
          {canModify ? (
            <>
              <Divider />
              <Action icon="edit" label="Edit" onPress={onEdit} />
              <Action icon="trash" label="Delete" danger onPress={onDelete} />
            </>
          ) : null}
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.45)" },
  sheet: { borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  preview: { paddingHorizontal: 8, paddingBottom: 10, gap: 2 },
  reactions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  reaction: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  reactionEmoji: { fontSize: 26, lineHeight: 32 },
  action: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 10, paddingVertical: 13, borderRadius: 10 },
});
