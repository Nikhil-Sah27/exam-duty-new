import { Stack } from "expo-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

import { Banner, Button, EmptyState, Icon, Text } from "@/components/ui";
import { AlertsBell } from "@/features/notifications/AlertsBell";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

import type { ChatMessage, Conversation } from "./api";
import { MessageActionSheet } from "./components/MessageActionSheet";
import { MessageComposer } from "./components/MessageComposer";
import { MessageSearchBar } from "./components/MessageSearchBar";
import { MessageThread, type ThreadRow } from "./components/MessageThread";
import { myReaction } from "./format";
import {
  useDeleteMessage,
  useEditMessage,
  usePendingSends,
  useReactMessage,
  useSendMessage,
  useThread,
  type ChatChannel,
} from "./hooks";
import { useKeyboardInset } from "./useKeyboardInset";

const newTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface ChatScreenProps {
  /** Which chat: the teacher's thread with CS, or one CS ↔ teacher conversation. */
  channel: ChatChannel;
  /** Header title, given the loaded conversation (CS shows the teacher's name). */
  renderTitle: (conversation: Conversation | undefined) => ReactNode;
  /** Shown before the first message. */
  emptyMessage: string;
}

/**
 * One chat, WhatsApp-style (ports of the web chat): day dividers, replies,
 * edit / delete-for-everyone, reactions, read ticks, search, pending bubbles.
 * The same screen serves both sides — the teacher's thread with the CS office
 * (MessagesScreen) and CS's chat with one teacher (CsChatScreen) — `channel`
 * says which, and whether the viewer's own bubbles are the CS ones.
 */
export default function ChatScreen({ channel, renderTitle, emptyMessage }: ChatScreenProps) {
  const { colors } = useTheme();
  const { ref: rootRef, onLayout: onRootLayout, inset: keyboardInset, keyboardOpen } = useKeyboardInset();
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const { viewerIsCs } = channel;

  const thread = useThread(channel);
  const send = useSendMessage(channel);
  const pending = usePendingSends(channel);
  const edit = useEditMessage(channel);
  const del = useDeleteMessage(channel);
  const react = useReactMessage(channel);
  const conversation = thread.data?.conversation;

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ThreadRow>>(null);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);

  const messages = useMemo(() => thread.data?.messages ?? [], [thread.data]);
  const hasMessages = messages.length > 0;

  // Search matches (message ids, oldest first), as on the web.
  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages.filter((m) => !m.deleted && m.body.toLowerCase().includes(q)).map((m) => m._id);
  }, [term, messages]);
  const activeIdx = matches.length ? Math.min(activeMatch, matches.length - 1) : 0;
  const activeMatchId = searchOpen && matches.length ? matches[activeIdx] : null;

  const focusInputSoon = () => setTimeout(() => inputRef.current?.focus(), 250);

  // ── Thread actions (web useThreadActions) ──
  const onReply = (m: ChatMessage) => {
    if (editing) {
      setEditing(null);
      setText("");
    }
    setReplyTo(m);
    focusInputSoon();
  };

  const onEdit = (m: ChatMessage) => {
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
    setPickerOpen(false);
    focusInputSoon();
  };

  const onCancelEdit = () => {
    setEditing(null);
    setText("");
  };

  const onDelete = (m: ChatMessage) => {
    Alert.alert("Delete this message?", "It will be deleted for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (editing?._id === m._id) onCancelEdit();
          if (replyTo?._id === m._id) setReplyTo(null);
          del.mutateAsync(m._id).catch((e: unknown) => Alert.alert("Couldn't delete message", errorText(e)));
        },
      },
    ]);
  };

  const onReact = (m: ChatMessage, emoji: string) => {
    react.mutateAsync({ id: m._id, emoji }).catch((e: unknown) => Alert.alert("Couldn't react", errorText(e)));
  };

  const onCopy = (m: ChatMessage) => {
    Clipboard.setString(m.body);
    if (Platform.OS === "android") ToastAndroid.show("Copied", ToastAndroid.SHORT);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;

    if (editing) {
      const target = editing;
      setEditing(null);
      setText("");
      if (body !== target.body) {
        edit.mutateAsync({ id: target._id, body }).catch((e: unknown) => Alert.alert("Couldn't edit message", errorText(e)));
      }
      return;
    }

    const vars = { body, replyTo, tempId: newTempId(), createdAt: new Date().toISOString() };
    setText("");
    setReplyTo(null);
    setSendError(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    // mutateAsync (not mutate) so every send's failure is handled, even when several are in flight.
    send.mutateAsync(vars).catch((e: unknown) => {
      setSendError(errorText(e));
      // Give the text back so nothing typed is lost.
      setText((t) => (t.trim() ? t : vars.body));
      setReplyTo((r) => r ?? vars.replyTo);
    });
  };

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setTerm("");
      setActiveMatch(0);
    } else {
      setPickerOpen(false);
      setSearchOpen(true);
    }
  };

  const stepMatch = (dir: 1 | -1) => {
    if (!matches.length) return;
    setActiveMatch((activeIdx + dir + matches.length) % matches.length);
  };

  /** Close the action sheet and hand back the message it was opened for. */
  const takeSheet = () => {
    const m = sheetFor;
    setSheetFor(null);
    return m;
  };

  // Closed keyboard: the SafeAreaView below already clears the tab bar.
  const bottomInset = keyboardOpen ? keyboardInset : 0;

  let body;
  if (thread.isPending) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text muted>Loading messages…</Text>
      </View>
    );
  } else if (thread.isError && !thread.data) {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="error"
          title="Couldn't load your messages"
          message={thread.error.message}
          action={<Button title="Try again" icon="refresh" onPress={() => void thread.refetch()} loading={thread.isFetching} />}
        />
      </View>
    );
  } else {
    body = (
      <>
        {searchOpen ? (
          <MessageSearchBar
            term={term}
            onChangeTerm={(t) => {
              setTerm(t);
              setActiveMatch(0);
            }}
            active={activeIdx}
            total={matches.length}
            onStep={stepMatch}
            onClose={toggleSearch}
          />
        ) : null}
        {thread.isError ? (
          <View style={styles.inlineBanner}>
            <Banner tone="warning" title="Can't reach the server — retrying." />
          </View>
        ) : null}

        {hasMessages || pending.length > 0 ? (
          <MessageThread
            listRef={listRef}
            messages={messages}
            pending={pending}
            myUserId={myUserId}
            viewerIsCs={viewerIsCs}
            peerLastReadAt={(viewerIsCs ? conversation?.teacherLastReadAt : conversation?.csLastReadAt) ?? null}
            searchTerm={searchOpen ? term.trim() : ""}
            activeMatchId={activeMatchId}
            onLongPress={(m) => {
              Keyboard.dismiss();
              setSheetFor(m);
            }}
            onReact={onReact}
          />
        ) : (
          <Pressable style={styles.center} onPress={Keyboard.dismiss} accessible={false}>
            <EmptyState
              icon="chat"
              title="No messages yet"
              message={emptyMessage}
            />
          </Pressable>
        )}

        {sendError ? (
          <View style={styles.inlineBanner}>
            <Banner tone="danger" title="Message not sent">
              <Text variant="caption" color={colors.danger}>
                {sendError} Your text is back in the box — tap send to try again.
              </Text>
            </Banner>
          </View>
        ) : null}

        <MessageComposer
          inputRef={inputRef}
          text={text}
          onChangeText={setText}
          onSubmit={submit}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={onCancelEdit}
          pickerOpen={pickerOpen}
          onTogglePicker={setPickerOpen}
          bottomInset={bottomInset}
        />
      </>
    );
  }

  return (
    // The Messages tab turns off automatic insets, so this keeps the chat (and
    // its composer) above the tab bar; useKeyboardInset then measures the root
    // view's real bottom edge, so the keyboard maths needs no tab-bar height.
    <SafeAreaView edges={{ bottom: true }} style={[styles.flex, { backgroundColor: colors.background }]}>
    <View ref={rootRef} onLayout={onRootLayout} style={styles.flex}>
      <Stack.Screen
        options={{
          headerTitle: () => renderTitle(conversation),
          headerRight: () => (
            <View style={styles.headerActions}>
              {hasMessages ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={searchOpen ? "Close search" : "Search in conversation"}
                  onPress={toggleSearch}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.headerBtn,
                    { backgroundColor: searchOpen ? colors.surfaceMuted : "transparent", opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Icon name={searchOpen ? "close" : "search"} size={20} color={colors.primary} />
                </Pressable>
              ) : null}
              <AlertsBell />
            </View>
          ),
        }}
      />
      {body}

      <MessageActionSheet
        message={sheetFor}
        viewerIsCs={viewerIsCs}
        canModify={!!sheetFor && sheetFor.senderIsCs === viewerIsCs && !sheetFor.deleted}
        currentReaction={sheetFor ? myReaction(sheetFor, myUserId) : null}
        onClose={() => setSheetFor(null)}
        onReact={(emoji) => {
          const m = takeSheet();
          if (m) onReact(m, emoji);
        }}
        onReply={() => {
          const m = takeSheet();
          if (m) onReply(m);
        }}
        onCopy={() => {
          const m = takeSheet();
          if (m) onCopy(m);
        }}
        onEdit={() => {
          const m = takeSheet();
          if (m) onEdit(m);
        }}
        onDelete={() => {
          const m = takeSheet();
          if (m) onDelete(m);
        }}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  inlineBanner: { paddingHorizontal: 12, paddingVertical: 6 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
