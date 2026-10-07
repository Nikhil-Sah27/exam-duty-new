import { StyleSheet, Text, View } from "react-native";

import type { TeacherRole } from "@/lib/types";
import { radius, roleColors, spacing, useTheme } from "@/theme";

import type { DutyProgress } from "../api";

/**
 * Target progress for the active role — `assigned` (upcoming + ongoing +
 * completed, in the role's unit) against `target`, with the "Target reached"
 * state. Self-claims stay allowed after the target is reached (only CS
 * assignment is gated), so this informs rather than blocks.
 */
export function ProgressCard({ role, progress }: { role: TeacherRole; progress: DutyProgress | undefined }) {
  const { colors } = useTheme();
  const rc = roleColors[role];
  const unit = role === "invigilator" ? "duties" : "groups";

  if (!progress) {
    return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, height: 92 }]} />;
  }

  const { target, assigned, reached, eligible } = progress;
  const pct = target > 0 ? Math.min(1, assigned / target) : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.role, { backgroundColor: rc.bg }]}>
          <Text style={[styles.roleText, { color: rc.fg }]}>{rc.label}</Text>
        </View>
        {reached ? (
          <Text style={[styles.status, { color: colors.success }]}>✓ Target reached</Text>
        ) : (
          <Text style={[styles.status, { color: colors.textMuted }]}>
            {eligible && target > 0 ? `${Math.max(0, target - assigned)} more to reach target` : "No target set"}
          </Text>
        )}
      </View>
      <Text style={[styles.big, { color: colors.text }]}>
        {assigned}
        <Text style={[styles.of, { color: colors.textMuted }]}>
          {" "}
          / {target} {unit}
        </Text>
      </Text>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: reached ? colors.success : colors.primary }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  role: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  roleText: { fontSize: 12, fontWeight: "700" },
  status: { fontSize: 13, fontWeight: "600" },
  big: { fontSize: 28, fontWeight: "800", marginTop: spacing.sm },
  of: { fontSize: 15, fontWeight: "600" },
  track: { height: 8, borderRadius: radius.pill, marginTop: spacing.sm, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
});
