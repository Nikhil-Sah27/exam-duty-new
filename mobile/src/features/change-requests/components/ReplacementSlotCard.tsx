import { Text, View } from "react-native";

import { cardStyles, SelectableCard, SmallTag, StateBadge } from "@/features/select-duty/components/ui";
import type { CardState } from "@/features/select-duty/selection";
import { useTheme } from "@/theme";

import type { ReplacementSlot } from "../types";

// Port of frontend/src/modules/shared/change-requests/components/ReplacementDutyCard.tsx,
// drawn with the Select Duty card shell so picking a target looks like
// picking a duty. Date/time come from the section header above it.

export function ReplacementSlotCard({
  slot,
  selected,
  conflictReason,
  onPress,
  busy,
}: {
  slot: ReplacementSlot;
  selected: boolean;
  conflictReason: string | null;
  onPress: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const state: CardState = conflictReason ? "CONFLICT" : selected ? "SELECTED" : "AVAILABLE";
  return (
    <SelectableCard
      state={state}
      onPress={onPress}
      disabled={busy || Boolean(conflictReason)}
      accessibilityLabel={`${slot.buildingName || "Unknown"} room ${slot.roomNumber}, ${selected ? "selected" : conflictReason ? "time conflict" : "vacant"}`}>
      <View style={cardStyles.row}>
        <Text style={[cardStyles.title, { color: colors.text }]} numberOfLines={1}>
          {slot.buildingName || "Unknown"} — Room {slot.roomNumber}
        </Text>
        <StateBadge state={state} />
      </View>
      <Text style={[cardStyles.meta, { color: colors.textMuted }]}>
        {slot.examType} · Sem {slot.semester} · Floor {slot.floor} · {slot.capacity} seats
      </Text>
      {slot.departments.length > 0 && (
        <View style={cardStyles.tags}>
          {slot.departments.map((d) => (
            <SmallTag key={d} label={d.toUpperCase()} />
          ))}
        </View>
      )}
      {conflictReason ? <Text style={[cardStyles.hint, { color: colors.danger }]}>{conflictReason}</Text> : null}
    </SelectableCard>
  );
}
