import type { ReactNode } from "react";
import { View } from "react-native";

import { AlertsBell } from "./AlertsBell";

/**
 * A tab's top row: the screen's own title block on the left, the alerts bell
 * at the top right. Every tab uses this (the Messages tab puts the bell in its
 * stack header instead), so the bell sits in one place app-wide.
 */
export function TabHeader({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1, justifyContent: "center", minHeight: 40 }}>{children}</View>
      <AlertsBell />
    </View>
  );
}
