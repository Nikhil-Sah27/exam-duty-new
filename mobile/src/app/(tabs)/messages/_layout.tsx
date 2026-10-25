import { Stack } from "expo-router";

import { useTheme } from "@/theme";

// Native tabs draw no header of their own, so the Messages tab nests a Stack:
// the chat keeps its header (CS title, search, alerts bell).
export default function MessagesTabLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: true, contentStyle: { backgroundColor: colors.background } }} />;
}
