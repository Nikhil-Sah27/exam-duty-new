import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

import { Banner, EmptyState, Icon, Text } from "@/components/ui";
import { AlertsBell } from "@/features/notifications/AlertsBell";
import { useTheme } from "@/theme";

import { ConversationRow, teacherOf } from "./components/ConversationRow";
import { SearchField } from "./components/SearchField";
import { useConversations } from "./hooks";

/**
 * CS's message inbox (port of the web CsMessagesPage list): every teacher
 * conversation, newest first, with unread counts and a search; ✎ starts a new
 * chat. Tapping a row opens that teacher's chat.
 */
export default function CsInboxScreen() {
  const { colors } = useTheme();
  const list = useConversations();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = list.data ?? [];
    if (!term) return all;
    return all.filter((c) => {
      const t = teacherOf(c);
      return [t?.name, t?.email, t?.department, c.lastMessageBody].some((v) => v?.toLowerCase().includes(term));
    });
  }, [list.data, q]);

  return (
    // The Messages tab turns off automatic insets (for the chat); keep the list above the tab bar.
    <SafeAreaView edges={{ bottom: true }} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Messages",
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push("/cs/messages/new")}
                accessibilityRole="button"
                accessibilityLabel="New chat"
                hitSlop={8}
                style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon name="compose" size={22} color={colors.primary} />
              </Pressable>
              <AlertsBell />
            </View>
          ),
        }}
      />
      <SearchField value={q} onChangeText={setQ} placeholder="Search teachers or messages" />
      {list.isError && !list.data ? (
        <View style={{ padding: 16 }}>
          <Banner tone="danger" title="Couldn't load messages">
            <Text variant="caption" color={colors.danger}>
              {list.error.message} — pull down to retry.
            </Text>
          </Banner>
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() => router.push({ pathname: "/cs/messages/[id]", params: { id: item._id } })}
          />
        )}
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
        ListEmptyComponent={
          list.isLoading ? (
            <Text muted style={{ padding: 16 }}>
              Loading…
            </Text>
          ) : (
            <View style={{ padding: 24 }}>
              <EmptyState
                icon="chat"
                title={q ? "No matches" : "No conversations yet"}
                message={q ? "Try another name." : "Teachers' messages appear here. Tap ✎ to message a teacher."}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
});
