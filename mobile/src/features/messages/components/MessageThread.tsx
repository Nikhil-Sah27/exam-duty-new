import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { Icon, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import type { ChatMessage } from "../api";
import { formatDayDivider, formatMessageTime, isNewDay } from "../format";
import type { SendVars } from "../hooks";
import { MessageBubble, type TickStatus } from "./MessageBubble";

interface Row {
  key: string;
  message: ChatMessage;
  showDay: boolean;
  grouped: boolean;
  mine: boolean;
  status?: TickStatus;
}

interface Props {
  listRef: RefObject<FlatList<Row> | null>;
  messages: ChatMessage[];
  pending: SendVars[];
  myUserId: string | null;
  /** When CS last read the thread — the teacher's older messages show as read. */
  csLastReadAt: string | null;
  searchTerm: string;
  activeMatchId: string | null;
  onLongPress: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
}

export type ThreadRow = Row;

const NEAR_BOTTOM = 80;

/** A not-yet-confirmed send, shaped like a message so it renders as a pending bubble. */
function pendingAsMessage(p: SendVars, myUserId: string | null): ChatMessage {
  return {
    _id: p.tempId,
    conversation: "",
    sender: myUserId ?? "",
    senderIsCs: false,
    body: p.body,
    createdAt: p.createdAt,
    replyTo: p.replyTo
      ? { _id: p.replyTo._id, body: p.replyTo.body, senderIsCs: p.replyTo.senderIsCs, sender: p.replyTo.sender, deleted: p.replyTo.deleted }
      : null,
    reactions: [],
  };
}

/**
 * The scrolling thread (web MessageThread): day dividers, grouped bubbles, read
 * ticks, search highlighting and a jump-to-latest button with a new-message count.
 * The list is inverted so it opens at the newest message and stays pinned there as
 * the keyboard opens or new messages arrive.
 */
export function MessageThread({ listRef, messages, pending, myUserId, csLastReadAt, searchTerm, activeMatchId, onLongPress, onReact }: Props) {
  const { colors } = useTheme();
  const [atBottom, setAtBottom] = useState(true);
  const [seen, setSeen] = useState(0);

  const rows = useMemo(() => {
    const readCutoff = csLastReadAt ? new Date(csLastReadAt).getTime() : 0;
    const all: { message: ChatMessage; pending: boolean }[] = [
      ...messages.map((message) => ({ message, pending: false })),
      ...pending.map((p) => ({ message: pendingAsMessage(p, myUserId), pending: true })),
    ];
    const out: Row[] = all.map(({ message: m, pending: isPending }, i) => {
      const prev = all[i - 1]?.message;
      const showDay = isNewDay(prev?.createdAt, m.createdAt);
      const mine = !m.senderIsCs;
      return {
        key: m._id,
        message: m,
        showDay,
        grouped: !showDay && !!prev && prev.senderIsCs === m.senderIsCs,
        mine,
        status: !mine ? undefined : isPending ? "pending" : readCutoff >= new Date(m.createdAt).getTime() ? "read" : "sent",
      };
    });
    return out.reverse(); // inverted list: newest first
  }, [messages, pending, myUserId, csLastReadAt]);

  // Bring the active search match into view — once per match, not on every poll
  // that rebuilds `rows`.
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (activeMatchId === scrolledTo.current) return;
    scrolledTo.current = activeMatchId;
    if (!activeMatchId) return;
    const index = rows.findIndex((r) => r.key === activeMatchId);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, [activeMatchId, rows, listRef]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const bottom = e.nativeEvent.contentOffset.y < NEAR_BOTTOM;
    if (bottom !== atBottom) {
      setAtBottom(bottom);
      setSeen(rows.length); // count arrivals from the moment the viewer scrolls away
    }
  };

  const newCount = atBottom ? 0 : Math.max(0, rows.length - seen);

  return (
    <View style={styles.flex}>
      <FlatList
        ref={listRef}
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) => (
          <View style={{ marginTop: item.grouped ? 2 : 10 }}>
            {item.showDay ? (
              <View style={styles.dayWrap}>
                <View style={[styles.dayPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text variant="caption" muted>
                    {formatDayDivider(item.message.createdAt)}
                  </Text>
                </View>
              </View>
            ) : null}
            <MessageBubble
              message={item.message}
              mine={item.mine}
              time={formatMessageTime(item.message.createdAt)}
              grouped={item.grouped}
              status={item.status}
              myUserId={myUserId}
              searchTerm={searchTerm}
              isActiveMatch={activeMatchId === item.key}
              onLongPress={onLongPress}
              onReact={onReact}
            />
          </View>
        )}
        // Inverted: the footer renders at the top, above the oldest message.
        ListFooterComponent={
          <Text variant="caption" muted style={styles.hint}>
            Messages go to the CS exam cell. Long-press a message to react, reply, copy, edit or delete.
          </Text>
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onScroll}
        scrollEventThrottle={64}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 150);
        }}
      />

      {!atBottom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={newCount > 0 ? `Scroll to latest, ${newCount} new` : "Scroll to latest"}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Icon name="arrowDown" size={18} color={colors.textMuted} />
          {newCount > 0 ? (
            <View style={[styles.fabBadge, { backgroundColor: colors.primaryDeep }]}>
              <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 10, fontWeight: "800" }}>
                {newCount > 99 ? "99+" : newCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  dayWrap: { alignItems: "center", marginVertical: 10 },
  dayPill: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 4 },
  hint: { textAlign: "center", paddingHorizontal: 24, paddingVertical: 12 },
  fab: {
    position: "absolute",
    right: 14,
    bottom: 12,
    height: 40,
    minWidth: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabBadge: { borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
});
