import { Stack } from "expo-router";

import { useTheme } from "@/theme";

/**
 * The Messages tab's navigator, for both teachers and CS. Native tabs draw no
 * header of their own, so the tab nests a Stack: the chat (and CS's inbox and
 * new-chat picker) keep their headers — title, search, alerts bell.
 */
export default function MessagesTabStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: true, contentStyle: { backgroundColor: colors.background } }} />;
}
