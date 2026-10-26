import { View } from "react-native";

import { Card, Chip, Text } from "@/components/ui";
import type { DashboardAssignmentTarget } from "@/features/select-duty/shared/dashboardSelectors";
import { examTitle } from "@/lib/format";
import { useTheme } from "@/theme";

import { StatTile } from "./StatTile";

/** "Sunday, 27 Sep 2026" — the web dashboard's format. */
function formatFull(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The next exam date's teacher-assignment status (port of the web's
 * AssignmentStatusSection, counts only): every classroom of every exam on that
 * date, as Not assigned / Partially assigned / Fully assigned.
 */
export function AssignmentStatusCard({ target }: { target: DashboardAssignmentTarget }) {
  const { colors } = useTheme();
  if (!target.date) return null;
  return (
    <Card>
      <View style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text variant="heading">{target.isTomorrow ? "Tomorrow's exams" : "Next exams"}</Text>
          <Text variant="caption" muted>
            {formatFull(target.date)} · {target.totalClasses} {target.totalClasses === 1 ? "class" : "classes"} — teacher assignment status
          </Text>
        </View>
        {target.exams.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {target.exams.map((e) => (
              <Chip key={e.examGroupId} label={examTitle(e.examType, e.semester)} fg={colors.primaryDeep} bg={colors.infoBg} />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile label="Not assigned" value={target.notAssigned} fg={colors.danger} bg={colors.dangerBg} />
          <StatTile label="Partially assigned" value={target.partiallyAssigned} fg={colors.warning} bg={colors.warningBg} />
          <StatTile label="Fully assigned" value={target.fullyAssigned} fg={colors.success} bg={colors.successBg} />
        </View>
      </View>
    </Card>
  );
}
