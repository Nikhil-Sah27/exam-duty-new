import { View } from "react-native";

import { Button, Card, Icon, RoleChip, Text } from "@/components/ui";
import { examTitle, formatClock, relativeExamDay } from "@/lib/format";
import type { DutyUnit } from "@/lib/types";
import { useTheme } from "@/theme";

interface Props {
  unit: DutyUnit;
  onPress?: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
}

export function DutyUnitCard({ unit, onPress, onConfirm, confirming }: Props) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <RoleChip role={unit.role} />
        {unit.confirmed ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="check" size={16} color={colors.success} />
            <Text variant="caption" color={colors.success}>
              Confirmed
            </Text>
          </View>
        ) : (
          <Text variant="caption" color={colors.warning}>
            Not confirmed
          </Text>
        )}
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="subheading">{examTitle(unit.examLabel, unit.semester)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="calendar" size={15} color={colors.textMuted} />
          <Text muted>
            {relativeExamDay(unit.date)} · {formatClock(unit.startTime)} – {formatClock(unit.endTime)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="location" size={15} color={colors.textMuted} />
          <Text muted style={{ flex: 1 }}>
            {unit.location}
          </Text>
        </View>
      </View>

      {!unit.confirmed && onConfirm ? (
        <Button title="Confirm I'll be there" icon="confirm" onPress={onConfirm} loading={confirming} />
      ) : null}
    </Card>
  );
}
