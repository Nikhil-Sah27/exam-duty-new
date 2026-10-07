import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { useAuthStore } from "@/store/auth";

import { selectRSDutyGroup } from "../api";
import { ClaimSectionList } from "../components/ClaimSectionList";
import { RSGroupCard } from "../components/DutyCards";
import { ClaimBar } from "../components/ui";
import { dayKey, formatDate, formatTimeRange } from "../format";
import { useAvailableDutySlots, useMyDuties } from "../hooks/queries";
import { useClaimRunner } from "../hooks/useClaimRunner";
import { useSelectionSet } from "../hooks/useSelectionSet";
import { sectionizeByWindow } from "../sections";
import { rsGroupWindow, rsStateOf, rsTakenRooms, rsValidate, summarizeConflicts } from "../selection";
import { groupRoomsIntoRSGroups } from "../shared/rsDutyGroupingUtils";
import type { RSDutyGroup } from "../shared/rsTypes";

const groupId = (g: RSDutyGroup) => g.groupId;
const groupLabel = (g: RSDutyGroup) => `${g.buildingName} — ${g.rangeLabel}`;

/**
 * RS Select Duty for one exam group — port of rs/select-duty. Groups are
 * derived with the shared `groupRoomsIntoRSGroups` over ALL slots first and
 * only then narrowed to this exam / day, exactly like useRSDutyGrouping, so a
 * filter can never reshuffle which rooms land in which group.
 */
export function RSExamDuties({ examGroupId }: { examGroupId: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const slotsQ = useAvailableDutySlots();
  const dutiesQ = useMyDuties(user?.id);
  const myDuties = useMemo(() => dutiesQ.data ?? [], [dutiesQ.data]);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const selection = useSelectionSet(groupId);

  const blockers = useMemo(
    () => ({ selected: selection.selected.map(rsGroupWindow), myDuties }),
    [selection.selected, myDuties],
  );

  const allGroups = useMemo(() => groupRoomsIntoRSGroups(slotsQ.data), [slotsQ.data]);
  const examGroups = useMemo(() => allGroups.filter((g) => g.examGroupId === examGroupId), [allGroups, examGroupId]);

  const dayChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of examGroups) seen.set(dayKey(g.date), formatDate(g.date));
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, label]) => ({ key, label }));
  }, [examGroups]);

  const visible = useMemo(
    () =>
      examGroups.filter((g) => {
        if (activeDay && dayKey(g.date) !== activeDay) return false;
        if (availableOnly) {
          const st = rsStateOf(g, selection.ids, blockers);
          if (st !== "AVAILABLE" && st !== "SELECTED") return false;
        }
        return true;
      }),
    [examGroups, activeDay, availableOnly, selection.ids, blockers],
  );

  // groupRoomsIntoRSGroups already orders date → start → building → chunk;
  // sectioning preserves that order inside each date/time window.
  const sections = useMemo(() => sectionizeByWindow(visible, (g) => g), [visible]);

  const banner = useMemo(() => {
    const pool = visible.filter((g) => !g.allAssigned && !selection.ids.has(g.groupId)).map(rsGroupWindow);
    return summarizeConflicts(pool, blockers);
  }, [visible, selection.ids, blockers]);

  const runner = useClaimRunner<RSDutyGroup>({
    claimOne: (g) =>
      selectRSDutyGroup({ examScheduleId: g.scheduleId, examRoomIds: g.rooms.map((r) => r.examRoomId) }),
    labelOf: groupLabel,
    onDone: selection.clear,
  });

  const toggle = useCallback(
    (group: RSDutyGroup) => {
      if (selection.ids.has(group.groupId)) {
        selection.remove(group.groupId);
        return;
      }
      const v = rsValidate(group, selection.ids, blockers);
      if (!v.ok) {
        Alert.alert("Can't select this group", v.reason || "Cannot select this group.");
        return;
      }
      selection.add(group);
    },
    [selection, blockers],
  );

  const confirmClaim = useCallback(() => {
    const items = selection.selected;
    const lines = items
      .map(
        (g) =>
          `• ${formatDate(g.date)}, ${formatTimeRange(g.startTime, g.endTime)}\n   ${g.buildingName} — rooms ${g.rooms
            .map((r) => r.roomNumber)
            .join(", ")}`,
      )
      .join("\n");
    Alert.alert(
      items.length === 1 ? "Claim this RS group?" : `Claim ${items.length} RS groups?`,
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
      keyOf={groupId}
      renderCard={(g) => (
        <RSGroupCard
          group={g}
          state={rsStateOf(g, selection.ids, blockers)}
          takenRooms={rsTakenRooms(g)}
          onPress={() => toggle(g)}
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
        availableOnly || activeDay ? "No groups match these filters." : "No selectable room groups left in this exam."
      }
      footer={
        <ClaimBar
          count={selection.selected.length}
          unit={{ one: "group", many: "groups" }}
          pending={runner.isPending}
          onClaim={confirmClaim}
          onClear={selection.clear}
        />
      }
    />
  );
}
