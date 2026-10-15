import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { useAuthStore } from "@/store/auth";

import { selectDuty } from "../api";
import { ClaimSectionList } from "../components/ClaimSectionList";
import { SlotCard } from "../components/DutyCards";
import { ClaimBar } from "../components/ui";
import { dayKey, formatDate, formatTimeRange } from "../format";
import { useAvailableDutySlots, useMyDuties } from "../hooks/queries";
import { useClaimRunner } from "../hooks/useClaimRunner";
import { useSelectionSet } from "../hooks/useSelectionSet";
import { sectionizeByWindow } from "../sections";
import { invigilatorStateOf, invigilatorValidate, slotWindow, summarizeConflicts } from "../selection";
import type { AvailableDutySlot } from "../shared/examSelectors";
import { compareRoomNumbers } from "../shared/rsDutyGroupingUtils";

const slotId = (s: AvailableDutySlot) => s.slotId;
const slotLabel = (s: AvailableDutySlot) => `${s.buildingName} — Room ${s.roomNumber}`;

/** Invigilator Select Duty for one exam group — port of invigilator/select-duty. */
export function InvigilatorExamDuties({ examGroupId }: { examGroupId: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const slotsQ = useAvailableDutySlots();
  const dutiesQ = useMyDuties(user?.id);
  const myDuties = useMemo(() => dutiesQ.data ?? [], [dutiesQ.data]);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const selection = useSelectionSet(slotId);

  const blockers = useMemo(
    () => ({ selected: selection.selected.map(slotWindow), myDuties }),
    [selection.selected, myDuties],
  );

  const examSlots = useMemo(
    () =>
      slotsQ.data
        .filter((s) => s.examGroupId === examGroupId)
        .sort(
          (a, b) => a.buildingName.localeCompare(b.buildingName) || compareRoomNumbers(a.roomNumber, b.roomNumber),
        ),
    [slotsQ.data, examGroupId],
  );

  const dayChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of examSlots) seen.set(dayKey(s.date), formatDate(s.date));
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, label]) => ({ key, label }));
  }, [examSlots]);

  const visible = useMemo(
    () =>
      examSlots.filter((s) => {
        if (activeDay && dayKey(s.date) !== activeDay) return false;
        if (availableOnly) {
          const st = invigilatorStateOf(s, selection.ids, blockers);
          if (st !== "AVAILABLE" && st !== "SELECTED") return false;
        }
        return true;
      }),
    [examSlots, activeDay, availableOnly, selection.ids, blockers],
  );

  const sections = useMemo(() => sectionizeByWindow(visible, (s) => s), [visible]);

  // Banner (web conflictSummary): open, unselected slots blocked by a clash.
  const banner = useMemo(() => {
    const pool = visible
      .filter((s) => !s.flags.invigilatorAssigned && !selection.ids.has(s.slotId))
      .map(slotWindow);
    return summarizeConflicts(pool, blockers);
  }, [visible, selection.ids, blockers]);

  const runner = useClaimRunner<AvailableDutySlot>({
    claimOne: (s) => selectDuty({ examScheduleId: s.scheduleId, examRoomId: s.examRoomId }),
    labelOf: slotLabel,
    onDone: selection.clear,
  });

  const toggle = useCallback(
    (slot: AvailableDutySlot) => {
      if (selection.ids.has(slot.slotId)) {
        selection.remove(slot.slotId);
        return;
      }
      const v = invigilatorValidate(slot, selection.ids, blockers);
      if (!v.ok) {
        Alert.alert("Can't select this slot", v.reason || "Cannot select this slot.");
        return;
      }
      selection.add(slot);
    },
    [selection, blockers],
  );

  const confirmClaim = useCallback(() => {
    const items = selection.selected;
    const lines = items
      .map((s) => `• ${formatDate(s.date)}, ${formatTimeRange(s.startTime, s.endTime)}\n   ${slotLabel(s)}`)
      .join("\n");
    Alert.alert(
      items.length === 1 ? "Claim this duty?" : `Claim ${items.length} duties?`,
      `${items[0] ? `${items[0].examType} · Sem ${items[0].semester}\n\n` : ""}${lines}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Claim", onPress: () => runner.run(items) },
      ],
    );
  }, [selection.selected, runner]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["shared"] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <ClaimSectionList
      sections={sections}
      keyOf={slotId}
      renderCard={(s) => (
        <SlotCard
          slot={s}
          state={invigilatorStateOf(s, selection.ids, blockers)}
          onPress={() => toggle(s)}
          busy={runner.isPending}
        />
      )}
      dayChips={dayChips}
      activeDay={activeDay}
      onDay={setActiveDay}
      availableOnly={availableOnly}
      onToggleAvailableOnly={() => setAvailableOnly((v) => !v)}
      banner={banner}
      refreshing={refreshing}
      onRefresh={onRefresh}
      loading={slotsQ.isLoading || dutiesQ.isLoading}
      error={slotsQ.error || dutiesQ.error}
      onRetry={onRefresh}
      emptyMessage={
        availableOnly || activeDay ? "No slots match these filters." : "No selectable slots left in this exam."
      }
      footer={
        <ClaimBar
          count={selection.selected.length}
          unit={{ one: "duty", many: "duties" }}
          pending={runner.isPending}
          onClaim={confirmClaim}
          onClear={selection.clear}
        />
      }
    />
  );
}
