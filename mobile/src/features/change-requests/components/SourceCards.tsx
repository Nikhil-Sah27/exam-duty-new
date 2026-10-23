import type { ReactNode } from "react";
import { View } from "react-native";

import { Button, Card, Chip, RoleChip, Text } from "@/components/ui";
import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";
import type { Duty } from "@/features/select-duty/shared/dutyTypes";
import { useTheme } from "@/theme";

import type { RSUpcomingGroup } from "../shared/rsUpcomingGrouping";
import type { ValidationResult } from "../validation";
import { examLabel, InfoLine, TagRow, whenLabel } from "./parts";

// The teacher's own duty / group — the thing a request moves away from.
// Ports of invigilator/change-requests/components/MyDutyCard.tsx,
// rs/change-requests/components/RsOwnedGroupCard.tsx and
// dcs/change-requests/components/DcsGroupRequestCard.tsx ("owned" variant).

/** web describeRoom(duty) → "Main Block — 101" */
export function dutyRoomLabel(duty: Duty): string {
  const room = duty.examRoom?.room;
  const roomNumber = room?.roomNumber || duty.room || "—";
  const building = room?.building?.name;
  return building ? `${building} — ${roomNumber}` : roomNumber;
}

function Header({ role, tags }: { role: "invigilator" | "rs" | "dcs"; tags: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <RoleChip role={role} />
      {tags.filter(Boolean).map((t) => (
        <Chip key={t} label={t} fg={colors.textMuted} bg={colors.surfaceMuted} />
      ))}
    </View>
  );
}

export function DutySummary({ duty, footer }: { duty: Duty; footer?: ReactNode }) {
  const exam = examLabel(duty.examSchedule?.examGroup?.examType ?? duty.exam?.type, duty.examSchedule?.examGroup?.semester ?? duty.exam?.semester);
  return (
    <Card>
      <Header role="invigilator" tags={[exam]} />
      <View style={{ gap: 4 }}>
        <InfoLine icon="calendar">{whenLabel(duty.date, duty.startTime, duty.endTime)}</InfoLine>
        <InfoLine icon="room" strong>
          {dutyRoomLabel(duty)}
        </InfoLine>
        {duty.exam?.name ? (
          <Text variant="caption" muted>
            {duty.exam.name}
          </Text>
        ) : null}
      </View>
      {footer}
    </Card>
  );
}

export function RsGroupSummary({ group, footer }: { group: RSUpcomingGroup; footer?: ReactNode }) {
  return (
    <Card>
      <Header role="rs" tags={[examLabel(group.examType, group.semester), "RS group"]} />
      <View style={{ gap: 4 }}>
        <InfoLine icon="calendar">{whenLabel(group.date, group.startTime, group.endTime)}</InfoLine>
        <InfoLine icon="building" strong>
          {group.buildingName} — {group.rangeLabel}
        </InfoLine>
        <TagRow labels={group.rooms.map((r) => r.roomNumber)} />
        {group.departments.length > 0 ? (
          <Text variant="caption" muted>
            {group.departments.join(" · ")}
          </Text>
        ) : null}
      </View>
      {footer}
    </Card>
  );
}

export function DcsGroupSummary({ group, footer }: { group: DcsGroup; footer?: ReactNode }) {
  const rooms = group.assignedRooms.length;
  return (
    <Card>
      <Header
        role="dcs"
        tags={[group.examGroup ? examLabel(group.examGroup.examType, group.examGroup.semester) : "", `DCS group #${group.groupIndex}`]}
      />
      <View style={{ gap: 4 }}>
        <InfoLine icon="calendar">{whenLabel(group.schedule.date, group.schedule.startTime, group.schedule.endTime)}</InfoLine>
        <InfoLine icon="room" strong>
          {`${rooms} room${rooms === 1 ? "" : "s"} · ${group.assignedStudents} students`}
        </InfoLine>
        <TagRow labels={group.assignedRooms.map((er) => er.room.roomNumber)} />
        {group.assignedDepartments.length > 0 ? (
          <Text variant="caption" muted>
            {group.assignedDepartments.map((d) => d.toUpperCase()).join(" · ")}
          </Text>
        ) : null}
      </View>
      {footer}
    </Card>
  );
}

/**
 * The "Request change" action under a source card: disabled with "Request
 * pending" while one is in flight (one request per duty / group at a time,
 * enforced by the backend), or with the eligibility reason when it can't change.
 */
export function RequestChangeAction({
  pending,
  eligibility,
  onPress,
}: {
  pending: boolean;
  eligibility?: ValidationResult;
  onPress: () => void;
}) {
  const blocked = pending || (eligibility ? !eligibility.ok : false);
  return (
    <View style={{ gap: 4 }}>
      <Button
        title={pending ? "Request pending" : "Request change"}
        icon={pending ? "clock" : "swap"}
        variant={pending ? "secondary" : "primary"}
        disabled={blocked}
        onPress={onPress}
      />
      {pending ? (
        <Text variant="caption" muted style={{ textAlign: "center" }}>
          One request at a time — wait for CS to review it.
        </Text>
      ) : eligibility && !eligibility.ok && eligibility.reason ? (
        <Text variant="caption" muted style={{ textAlign: "center" }}>
          {eligibility.reason}
        </Text>
      ) : null}
    </View>
  );
}
