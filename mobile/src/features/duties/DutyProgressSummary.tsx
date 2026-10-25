import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Card, Text } from "@/components/ui";
import { useMyProgress } from "@/features/select-duty/hooks/queries";
import { dutyUnitFor, selectionStatus } from "./progressCopy";
import type { TeacherRole } from "@/lib/types";
import { radius, roleColors, spacing, useTheme } from "@/theme";

/**
 * Home-screen duty tally for the active role — Completed (past), Remaining
 * (target − completed), Target, then the selection status line: the same
 * numbers, order and words as the web dashboard's HeroDutyCircles, all straight
 * from the backend progress endpoint. Works for every teacher role:
 * invigilator counts single duties, RS/DCS count groups. Reads the same
 * `useMyProgress` query the Select-Duty flow uses, so a claim invalidating
 * `["duty-calculation"]` refreshes this card too.
 */
function Stat({ label, value, color, onPress }: { label: string; value: number; color: string; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="title" color={color}>
        {value}
      </Text>
      <Text variant="caption" muted>
        {label}
        {onPress ? " ›" : ""}
      </Text>
    </>
  );
  if (!onPress) return <View style={{ flex: 1, gap: 2 }}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}, show list`}
      style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function DutyProgressSummary({ role }: { role: TeacherRole }) {
  const { colors } = useTheme();
  const { data: progress, isLoading, isError } = useMyProgress(role);
  const rc = roleColors[role];

  // Upcoming-duty load errors already surface their own banner below — keep the
  // summary quiet rather than stacking a second error on the home screen.
  if (isError) return null;

  const target = progress?.target ?? 0;
  const completed = progress?.completed ?? 0;
  const remaining = progress?.remaining ?? 0;
  const eligible = progress?.eligible ?? false;
  const reached = progress?.reached ?? false;
  const pct = target > 0 ? Math.min(1, completed / target) : 0;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="heading">Your duty progress</Text>
        <View
          style={{
            backgroundColor: rc.bg,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="caption" color={rc.fg}>
            {rc.label}
          </Text>
        </View>
      </View>

      {isLoading && !progress ? (
        <Text muted>Loading your progress…</Text>
      ) : !eligible || target === 0 ? (
        <Text variant="caption" muted>
          No duty target set for this role yet.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: "row" }}>
            <Stat label="Completed" value={completed} color={colors.success} onPress={() => router.push("/completed-duties")} />
            <Stat label="Remaining" value={remaining} color={remaining === 0 ? colors.success : colors.primary} />
            <Stat label="Target" value={target} color={colors.text} />
          </View>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: "hidden" }}>
            <View
              style={{
                height: 8,
                borderRadius: radius.pill,
                width: `${pct * 100}%`,
                backgroundColor: remaining === 0 ? colors.success : colors.primary,
              }}
            />
          </View>
          <Text variant="caption" color={reached ? colors.success : colors.textMuted}>
            {progress && selectionStatus(progress, dutyUnitFor(role))}
          </Text>
        </>
      )}
    </Card>
  );
}
