import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { ROLE_LABELS } from "@/lib/roles";
import type { TeacherRole } from "@/lib/types";
import { roleColors, useTheme } from "@/theme";

export { ROLE_LABELS };

export function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const { radius } = useTheme();
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text variant="caption" color={fg} style={{ fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

export function RoleChip({ role }: { role: TeacherRole }) {
  const c = roleColors[role];
  return <Chip label={c.label} fg={c.fg} bg={c.bg} />;
}
