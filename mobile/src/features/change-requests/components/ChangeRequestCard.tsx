import type { ReactNode } from "react";
import { Linking, View } from "react-native";

import { Card, Chip, Icon, Text } from "@/components/ui";
import { compareRoomNumbers } from "@/features/select-duty/shared/rsDutyGroupingUtils";
import { formatShortDate } from "@/features/select-duty/format";
import { timeAgo } from "@/lib/format";
import { roleColors, useTheme } from "@/theme";

import { requestRole } from "../hooks";
import type { ChangeRequest, DcsGroupRef, RsSourceDutyRef, RsTargetExamRoomRef } from "../types";
import { examLabel, InfoLine, Panel, SectionLabel, StatusChip, TagRow, whenLabel } from "./parts";

// Port of frontend/src/modules/shared/change-requests/components/ChangeRequestCard.tsx
// (teacher view, or with `reviewer` the CS view: requester + contact, and the
// approve/reject `actions`; no delete control) and its
// change-request-card/{DutyBlock,RsGroupBlock,DcsGroupBlock,changeRequestCardUtils}.

/** changeRequestCardUtils.rsGroupSummary */
function rsGroupSummary(
  duties: readonly RsSourceDutyRef[] | undefined,
  rooms: readonly RsTargetExamRoomRef[] | undefined,
  side: "source" | "target",
) {
  const items = side === "source" ? (duties ?? []) : (rooms ?? []);
  if (items.length === 0) return null;
  const first = side === "source" ? (items[0] as RsSourceDutyRef).examRoom?.room : (items[0] as RsTargetExamRoomRef).room;
  const buildingName = first?.building?.name || "—";
  const roomNumbers =
    side === "source"
      ? (duties ?? []).map((d) => d.examRoom?.room?.roomNumber || d.room)
      : (rooms ?? []).map((er) => er.room?.roomNumber || "");
  const sorted = [...roomNumbers].sort(compareRoomNumbers);
  const rangeLabel =
    sorted.length === 0 ? "" : sorted.length === 1 ? `Room ${sorted[0]}` : `Rooms ${sorted[0]}–${sorted[sorted.length - 1]}`;
  const schedule = side === "source" ? (items[0] as RsSourceDutyRef).examSchedule : (items[0] as RsTargetExamRoomRef).schedule;
  const depts = new Set<string>();
  if (side === "source") {
    for (const d of duties ?? []) for (const dep of d.examRoom?.departments ?? []) depts.add(dep.toUpperCase());
  } else {
    for (const er of rooms ?? []) for (const dep of er.departments ?? []) depts.add(dep.toUpperCase());
  }
  return { buildingName, rangeLabel, roomNumbers: sorted, schedule, departments: [...depts].sort() };
}

function Arrow() {
  const { colors } = useTheme();
  return (
    <Text style={{ textAlign: "center", fontSize: 18, lineHeight: 20, color: colors.textMuted }} accessibilityElementsHidden>
      ↓
    </Text>
  );
}

function DutyBlock(props: { label: string; date: string; startTime: string; endTime: string; room: string; exam?: string }) {
  return (
    <Panel>
      <SectionLabel>{props.label}</SectionLabel>
      <InfoLine icon="calendar">{whenLabel(props.date, props.startTime, props.endTime)}</InfoLine>
      <InfoLine icon="room" strong>
        {props.room}
      </InfoLine>
      {props.exam ? (
        <Text variant="caption" muted>
          {props.exam}
        </Text>
      ) : null}
    </Panel>
  );
}

function RsBlock({ label, summary }: { label: string; summary: NonNullable<ReturnType<typeof rsGroupSummary>> }) {
  const exam = summary.schedule?.examGroup ? examLabel(summary.schedule.examGroup.examType, summary.schedule.examGroup.semester) : "";
  return (
    <Panel>
      <SectionLabel>{label}</SectionLabel>
      {summary.schedule ? (
        <InfoLine icon="calendar">{whenLabel(summary.schedule.date, summary.schedule.startTime, summary.schedule.endTime)}</InfoLine>
      ) : null}
      <InfoLine icon="building" strong>
        {summary.buildingName} — {summary.rangeLabel}
      </InfoLine>
      <TagRow labels={summary.roomNumbers} />
      {summary.departments.length > 0 || exam ? (
        <Text variant="caption" muted>
          {[exam, summary.departments.join(" · ")].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}
    </Panel>
  );
}

function DcsBlock({ label, group }: { label: string; group: DcsGroupRef }) {
  const exam = group.examGroup ? examLabel(group.examGroup.examType, group.examGroup.semester) : "";
  return (
    <Panel>
      <SectionLabel>{label}</SectionLabel>
      <InfoLine icon="calendar">{whenLabel(group.schedule.date, group.schedule.startTime, group.schedule.endTime)}</InfoLine>
      <InfoLine icon="room" strong>
        {`DCS group #${group.groupIndex} · ${group.assignedRooms.length} room${group.assignedRooms.length === 1 ? "" : "s"}`}
      </InfoLine>
      <TagRow labels={group.assignedRooms.map((er) => er.room.roomNumber)} />
      {group.assignedDepartments.length > 0 || exam ? (
        <Text variant="caption" muted>
          {[exam, group.assignedDepartments.map((d) => d.toUpperCase()).join(" · ")].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Who asked — name, department, tap-to-call / tap-to-email (CS review view). */
function Requester({ user }: { user: ChangeRequest["requestedBy"] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="person" size={14} color={colors.textMuted} />
        <Text variant="caption" style={{ fontWeight: "700" }}>
          {user.name}
        </Text>
        {user.department ? (
          <Text variant="caption" muted>
            · {user.department}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {user.phone ? (
          <Text variant="caption" color={colors.primary} onPress={() => void Linking.openURL(`tel:${user.phone}`)}>
            {user.phone}
          </Text>
        ) : null}
        {user.email ? (
          <Text variant="caption" color={colors.primary} onPress={() => void Linking.openURL(`mailto:${user.email}`)}>
            {user.email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ChangeRequestCard({
  request: r,
  reviewer = false,
  actions,
}: {
  request: ChangeRequest;
  /** CS's review view: shows the requester and speaks of "their" reason. */
  reviewer?: boolean;
  /** Approve / reject controls (CS, pending requests). */
  actions?: ReactNode;
}) {
  const { colors } = useTheme();
  const role = requestRole(r);
  const isDcsSwap = role === "dcs";
  const isRsSwap = role === "rs";

  // Lead with the ROLE, then the action — "INVIGILATOR MOVE", "RS SWAP", "DCS SWAP".
  const roleLabel = isDcsSwap ? "DCS" : isRsSwap ? "RS" : "Invigilator";
  const actionLabel = isDcsSwap || isRsSwap || r.type === "swap" ? "Swap" : r.type === "move" ? "Move" : "Drop";
  const rc = roleColors[role];

  // Left edge by review status so a long list scans at a glance.
  const edge =
    r.status === "approved" ? colors.success : r.status === "rejected" ? colors.danger : r.status === "pending" ? colors.warning : colors.border;

  const currentRoom = r.duty?.roomRef?.roomNumber
    ? `${r.duty.roomRef.building?.name || "Unknown"} — ${r.duty.roomRef.roomNumber}`
    : r.duty?.room || "—";

  const movingTo =
    r.type === "move" && r.requestedDate && r.requestedStartTime && r.requestedEndTime
      ? {
          date: r.requestedDate,
          startTime: r.requestedStartTime,
          endTime: r.requestedEndTime,
          room: r.requestedExamRoom?.room
            ? `${r.requestedExamRoom.room.building?.name || "Unknown"} — ${r.requestedExamRoom.room.roomNumber}`
            : r.requestedRoom || "—",
          exam: r.requestedSchedule?.examGroup
            ? examLabel(r.requestedSchedule.examGroup.examType, r.requestedSchedule.examGroup.semester)
            : undefined,
        }
      : null;

  let body = null;
  if (isRsSwap) {
    const src = rsGroupSummary(r.rsSourceDuties, undefined, "source");
    const tgt = rsGroupSummary(undefined, r.rsTargetExamRooms, "target");
    if (src && tgt) {
      body = (
        <>
          <RsBlock label="Current assignment" summary={src} />
          <Arrow />
          <RsBlock label="Requested assignment" summary={tgt} />
        </>
      );
    }
  } else if (isDcsSwap && r.dcsSourceGroup && r.dcsTargetGroup) {
    body = (
      <>
        <DcsBlock label="Current assignment" group={r.dcsSourceGroup} />
        <Arrow />
        <DcsBlock label="Requested assignment" group={r.dcsTargetGroup} />
      </>
    );
  } else if (r.duty) {
    body = (
      <>
        <DutyBlock
          label="Current"
          date={r.duty.date}
          startTime={r.duty.startTime}
          endTime={r.duty.endTime}
          room={currentRoom}
          exam={r.duty.exam?.name}
        />
        {movingTo ? (
          <>
            <Arrow />
            <DutyBlock label="Requested" {...movingTo} />
          </>
        ) : null}
      </>
    );
  }

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: edge }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Chip label={`${roleLabel} ${actionLabel}`.toUpperCase()} fg={rc.fg} bg={rc.bg} />
        <StatusChip status={r.status} />
        <Text variant="caption" muted style={{ marginLeft: "auto" }}>
          {timeAgo(r.createdAt)}
        </Text>
      </View>

      {reviewer ? <Requester user={r.requestedBy} /> : null}

      {body}

      {r.reason ? (
        <Panel tone="muted">
          <Text variant="caption">
            <Text variant="caption" style={{ fontWeight: "700" }}>
              {reviewer ? "Reason:" : "Your reason:"}{" "}
            </Text>
            {r.reason}
          </Text>
        </Panel>
      ) : null}

      {r.reviewNote ? (
        <Panel tone={r.status === "approved" ? "success" : "danger"}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Icon name="chat" size={15} color={r.status === "approved" ? colors.success : colors.danger} />
            <Text variant="caption" color={r.status === "approved" ? colors.success : colors.danger} style={{ flex: 1 }}>
              <Text variant="caption" color={r.status === "approved" ? colors.success : colors.danger} style={{ fontWeight: "700" }}>
                {reviewer ? "Your note:" : "Note from CS:"}{" "}
              </Text>
              {r.reviewNote}
            </Text>
          </View>
        </Panel>
      ) : null}

      {r.status === "cancelled_exam_deleted" ? (
        <Text variant="caption" muted>
          Cancelled because the exam was removed.
        </Text>
      ) : r.status === "pending" ? (
        actions ?? (
          <Text variant="caption" muted>
            Waiting for the exam cell to review.
          </Text>
        )
      ) : r.reviewedAt ? (
        <Text variant="caption" muted>
          {r.status === "approved" ? "Approved" : "Rejected"} {formatShortDate(r.reviewedAt)}
          {r.reviewedBy?.name ? ` by ${r.reviewedBy.name}` : ""}
        </Text>
      ) : null}
    </Card>
  );
}
