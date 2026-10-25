import { View } from "react-native";

import { Card, Icon, Text } from "@/components/ui";
import { examTitle, formatClock, formatExamDate } from "@/lib/format";
import { useTheme } from "@/theme";

import type { CompletedDuty } from "./api";

const ROLE_UNIT: Record<CompletedDuty["role"], string> = {
  invigilator: "Duty",
  rs: "RS group",
  dcs: "DCS group",
};

/** "Rooms 101, 102 · Block A" — buildings listed once, in order. */
function roomLine(rooms: CompletedDuty["rooms"]): string {
  const numbers = rooms.map((r) => r.roomNumber).filter(Boolean);
  const buildings = [...new Set(rooms.map((r) => r.building).filter(Boolean))];
  const label = `${numbers.length === 1 ? "Room" : "Rooms"} ${numbers.join(", ")}`;
  return buildings.length ? `${label} · ${buildings.join(", ")}` : label;
}

/** One completed duty (an RS / DCS group is one card listing all its rooms). */
export function CompletedDutyCard({ duty }: { duty: CompletedDuty }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Icon name="check" size={22} color={colors.success} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" style={{ fontWeight: "700" }}>
            {duty.examType ? examTitle(duty.examType, duty.semester) : ROLE_UNIT[duty.role]}
          </Text>
          <Text variant="caption" muted>
            {formatExamDate(duty.date)} · {formatClock(duty.startTime)} – {formatClock(duty.endTime)}
          </Text>
          {duty.rooms.length ? (
            <Text variant="caption" muted>
              {roomLine(duty.rooms)}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
