import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import type { ChatMessage } from "../api";
import { senderLabel, summarizeReactions } from "../format";

export type TickStatus = "pending" | "sent" | "read";

const HIGHLIGHT = { bg: "#fde68a", fg: "#0f172a", ring: "#facc15" };
const READ_TICK = "#7dd3fc";
const ON_MINE = "#ffffff";
const ON_MINE_MUTED = "rgba(255,255,255,0.75)";

/** Every case-insensitive occurrence of `term` in `text`, wrapped in a highlight span. */
function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const t = term.toLowerCase();
  const out: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const idx = rest.toLowerCase().indexOf(t);
    if (idx < 0) {
      out.push(rest);
      break;
    }
    if (idx > 0) out.push(rest.slice(0, idx));
    out.push(
      <Text key={key++} color={HIGHLIGHT.fg} style={{ backgroundColor: HIGHLIGHT.bg }}>
        {rest.slice(idx, idx + term.length)}
      </Text>,
    );
    rest = rest.slice(idx + term.length);
  }
  return out;
}

interface Props {
  message: ChatMessage;
  mine: boolean;
  time: string;
  grouped: boolean;
  status?: TickStatus;
  myUserId: string | null;
  searchTerm: string;
  isActiveMatch: boolean;
  onLongPress?: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
}

/** One chat bubble — brand-coloured and right-aligned for the viewer's own messages. */
export function MessageBubble({ message, mine, time, grouped, status, myUserId, searchTerm, isActiveMatch, onLongPress, onReact }: Props) {
  const { colors, isDark } = useTheme();
  const { deleted, replyTo, editedAt } = message;
  const reactions = deleted ? [] : summarizeReactions(message, myUserId);
  const pending = status === "pending";
  const senderName = !mine && !grouped && !deleted && typeof message.sender === "object" ? message.sender.name : null;

  const bubbleStyle = deleted
    ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1 }
    : mine
      ? {
          backgroundColor: colors.primaryDeep,
          borderTopRightRadius: grouped ? 6 : 18,
          borderBottomRightRadius: 6,
        }
      : {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderTopLeftRadius: grouped ? 6 : 18,
          borderBottomLeftRadius: 6,
        };

  const metaColor = mine && !deleted ? ON_MINE_MUTED : colors.textMuted;

  return (
    <View style={[styles.row, { alignItems: mine ? "flex-end" : "flex-start" }]}>
      <Pressable
        onLongPress={!deleted && !pending && onLongPress ? () => onLongPress(message) : undefined}
        delayLongPress={300}
        accessibilityHint={deleted || pending ? undefined : "Long-press for reply, reactions, copy, edit and delete"}
        style={({ pressed }) => [
          styles.bubble,
          bubbleStyle,
          isActiveMatch && { borderWidth: 2, borderColor: HIGHLIGHT.ring },
          pending && { opacity: 0.7 },
          pressed && !deleted && { opacity: 0.85 },
        ]}
      >
        {deleted ? (
          <View style={styles.deletedRow}>
            <Icon name="blocked" size={14} color={colors.textMuted} />
            <Text variant="body" muted style={styles.italic}>
              This message was deleted
            </Text>
          </View>
        ) : (
          <>
            {senderName ? (
              <Text variant="caption" color={colors.primary} style={styles.sender}>
                {senderName}
              </Text>
            ) : null}

            {replyTo ? (
              <View
                style={[
                  styles.quote,
                  mine
                    ? { backgroundColor: "rgba(255,255,255,0.15)", borderLeftColor: "rgba(255,255,255,0.6)" }
                    : { backgroundColor: isDark ? colors.surfaceMuted : "#eef2ff", borderLeftColor: colors.primary },
                ]}
              >
                <Text variant="caption" color={mine ? ON_MINE : colors.text} style={{ fontWeight: "700" }}>
                  {senderLabel(replyTo)}
                </Text>
                <Text variant="caption" numberOfLines={2} color={mine ? ON_MINE_MUTED : colors.textMuted}>
                  {replyTo.deleted ? "Deleted message" : replyTo.body}
                </Text>
              </View>
            ) : null}

            <Text color={mine ? ON_MINE : colors.text} style={styles.body}>
              {searchTerm ? highlight(message.body, searchTerm) : message.body}
            </Text>

            <View style={styles.meta}>
              {editedAt ? (
                <Text variant="caption" color={metaColor} style={[styles.metaText, styles.italic]}>
                  edited
                </Text>
              ) : null}
              <Text variant="caption" color={metaColor} style={styles.metaText}>
                {time}
              </Text>
              {mine && status ? (
                <View accessibilityLabel={status === "read" ? "Read" : status === "sent" ? "Sent" : "Sending"}>
                  <Icon
                    name={status === "read" ? "ticks" : status === "sent" ? "tick" : "clock"}
                    size={13}
                    color={status === "read" ? READ_TICK : ON_MINE_MUTED}
                  />
                </View>
              ) : null}
            </View>
          </>
        )}
      </Pressable>

      {reactions.length > 0 ? (
        <View style={[styles.reactions, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => onReact(message, r.emoji)}
              accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ", yours — tap to remove" : ""}`}
              style={({ pressed }) => [
                styles.reactionChip,
                {
                  backgroundColor: r.mine ? (isDark ? colors.surfaceMuted : "#e0e7ff") : colors.surface,
                  borderColor: r.mine ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              {r.count > 1 ? (
                <Text variant="caption" muted style={{ fontWeight: "700" }}>
                  {r.count}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%" },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 7 },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 2 },
  italic: { fontStyle: "italic" },
  sender: { fontWeight: "700", marginBottom: 2 },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, lineHeight: 14 },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: -4, paddingHorizontal: 6, maxWidth: "82%" },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionEmoji: { fontSize: 14, lineHeight: 20 },
});
