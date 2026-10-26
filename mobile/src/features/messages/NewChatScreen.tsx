import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

import { EmptyState, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { SearchField } from "./components/SearchField";
import { initials } from "./format";
import { useMessageableTeachers, useStartConversation } from "./hooks";

/**
 * CS picks a teacher to message (port of the web NewConversationModal): search
 * by name, email or department; picking one opens (or reuses) their chat.
 */
export default function NewChatScreen() {
  const { colors } = useTheme();
  const teachers = useMessageableTeachers();
  const start = useStartConversation();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = [...(teachers.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return all;
    return all.filter((t) => [t.name, t.email, t.department].some((v) => v?.toLowerCase().includes(term)));
  }, [teachers.data, q]);

  const open = (teacherId: string) =>
    start
      .mutateAsync(teacherId)
      .then((c) => router.replace({ pathname: "/cs/messages/[id]", params: { id: c._id } }))
      .catch((e: unknown) => Alert.alert("Couldn't open the chat", e instanceof Error ? e.message : String(e)));

  return (
    <SafeAreaView edges={{ bottom: true }} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "New chat" }} />
      <SearchField value={q} onChangeText={setQ} placeholder="Search teachers" autoFocus />
      <FlatList
        data={rows}
        keyExtractor={(t) => t._id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: t }) => (
          <Pressable
            onPress={() => void open(t._id)}
            disabled={start.isPending}
            style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed || start.isPending ? 0.6 : 1 }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primaryDeep }]}>
              <Text variant="label" color={colors.onPrimary}>
                {initials(t.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                {t.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {[t.designation, t.department].filter(Boolean).join(" · ") || t.email}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          teachers.isLoading ? (
            <Text muted style={{ padding: 16 }}>
              Loading teachers…
            </Text>
          ) : (
            <View style={{ padding: 24 }}>
              <EmptyState icon="person" title="No teachers found" message={q ? "Try another name." : "There are no teachers to message yet."} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
