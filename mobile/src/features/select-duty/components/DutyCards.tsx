import { Text, View } from "react-native";

import { useTheme } from "@/theme";

import { formatTimeRange } from "../format";
import type { CardState } from "../selection";
import type { DcsGroup } from "../shared/dcsTypes";
import type { AvailableDutySlot } from "../shared/examSelectors";
import type { RSDutyGroup } from "../shared/rsTypes";
import { cardStyles, SelectableCard, SmallTag, StateBadge } from "./ui";

// Occupied cards deliberately name nobody: only CS sees who holds a duty
// (CLAUDE.md, RoleAssignmentCard). The viewer's own cards read "Yours".

const disabledFor = (state: CardState) => state === "FULL" || state === "MINE";

/** Invigilator: one room. */
export function SlotCard({
  slot,
  state,
  onPress,
  busy,
}: {
  slot: AvailableDutySlot;
  state: CardState;
  onPress: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SelectableCard
      state={state}
      onPress={onPress}
      disabled={busy || disabledFor(state)}
      accessibilityLabel={`${slot.buildingName} room ${slot.roomNumber}, ${state.toLowerCase()}`}>
      <View style={cardStyles.row}>
        <Text style={[cardStyles.title, { color: colors.text }]} numberOfLines={1}>
          {slot.buildingName} — Room {slot.roomNumber}
        </Text>
        <StateBadge state={state} />
      </View>
      <Text style={[cardStyles.meta, { color: colors.textMuted }]}>
        {formatTimeRange(slot.startTime, slot.endTime)} · {slot.capacity} seats
      </Text>
      {slot.departments.length > 0 && (
        <View style={cardStyles.tags}>
          {slot.departments.map((d) => (
            <SmallTag key={d} label={d.toUpperCase()} />
          ))}
        </View>
      )}
    </SelectableCard>
  );
}

/** RS: a derived group of up to 5 rooms in one building + slot. */
export function RSGroupCard({
  group,
  state,
  takenRooms,
  onPress,
  busy,
}: {
  group: RSDutyGroup;
  state: CardState;
  takenRooms: number;
  onPress: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SelectableCard
      state={state}
      onPress={onPress}
      disabled={busy || disabledFor(state)}
      accessibilityLabel={`${group.buildingName} ${group.rangeLabel}, ${state.toLowerCase()}`}>
      <View style={cardStyles.row}>
        <Text style={[cardStyles.title, { color: colors.text }]} numberOfLines={1}>
          {group.buildingName} — {group.rangeLabel}
        </Text>
        <StateBadge state={state} />
      </View>
      <Text style={[cardStyles.meta, { color: colors.textMuted }]}>
        {formatTimeRange(group.startTime, group.endTime)} · {group.rooms.length} room
        {group.rooms.length === 1 ? "" : "s"}
      </Text>
      <View style={cardStyles.tags}>
        {group.rooms.map((r) => (
          <SmallTag key={r.examRoomId} label={r.roomNumber} />
        ))}
      </View>
      {group.departments.length > 0 && (
        <Text style={[cardStyles.hint, { color: colors.textMuted }]}>{group.departments.join(" · ")}</Text>
      )}
      {state !== "FULL" && state !== "MINE" && takenRooms > 0 && (
        <Text style={[cardStyles.hint, { color: colors.warning }]}>
          {takenRooms} of {group.rooms.length} rooms already have an RS — this group can&apos;t be claimed whole.
        </Text>
      )}
    </SelectableCard>
  );
}

/** DCS: a persisted DCSGroup (sized at exam finalize, 1 DCS per 300 students). */
export function DcsGroupCard({
  group,
  ordinal,
  state,
  onPress,
  busy,
}: {
  group: DcsGroup;
  ordinal: number | undefined;
  state: CardState;
  onPress: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const buildings = [
    ...new Set(group.assignedRooms.map((r) => r.room.building?.name).filter((n): n is string => Boolean(n))),
  ];
  return (
    <SelectableCard
      state={state}
      onPress={onPress}
      disabled={busy || disabledFor(state)}
      accessibilityLabel={`DCS group ${ordinal ?? group.groupIndex}, ${state.toLowerCase()}`}>
      <View style={cardStyles.row}>
        <Text style={[cardStyles.title, { color: colors.text }]} numberOfLines={1}>
          DCS Group {ordinal ?? group.groupIndex}
        </Text>
        <StateBadge state={state} />
      </View>
      <Text style={[cardStyles.meta, { color: colors.textMuted }]}>
        {formatTimeRange(group.schedule.startTime, group.schedule.endTime)} · {group.assignedRooms.length} room
        {group.assignedRooms.length === 1 ? "" : "s"} · {group.assignedStudents} students
      </Text>
      {buildings.length > 0 && (
        <Text style={[cardStyles.meta, { color: colors.textMuted }]}>{buildings.join(", ")}</Text>
      )}
      <View style={cardStyles.tags}>
        {group.assignedRooms.map((r) => (
          <SmallTag key={r._id} label={r.room.roomNumber} />
        ))}
      </View>
      {group.assignedDepartments.length > 0 && (
        <Text style={[cardStyles.hint, { color: colors.textMuted }]}>
          {group.assignedDepartments.map((d) => d.toUpperCase()).join(" · ")}
        </Text>
      )}
    </SelectableCard>
  );
}
