import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { useAuthStore } from "@/store/auth";

import { claimDcsGroup } from "../api";
import { ClaimSectionList } from "../components/ClaimSectionList";
import { DcsGroupCard } from "../components/DutyCards";
import { ClaimBar } from "../components/ui";
import { dayKey, formatDate, formatTimeRange } from "../format";
import { KEYS, useDcsGroups, useMyDuties } from "../hooks/queries";
import { useClaimRunner } from "../hooks/useClaimRunner";
import { useSelectionSet } from "../hooks/useSelectionSet";
import { sectionizeByWindow } from "../sections";
import { dcsGroupWindow, dcsStateOf, dcsValidate, summarizeConflicts } from "../selection";
import { buildDcsGroupOrdinalMap, buildDcsGroups } from "../shared/dcsGroupingService";
import type { DcsGroup } from "../shared/dcsTypes";
import { selectableFilter } from "../shared/dutyStatusFilter";

const dcsId = (g: DcsGroup) => g._id;

/**
 * DCS Select Duty for one exam group — port of dcs/select-duty. Groups are the
 * persisted DCSGroup docs (sized server-side at exam finalize); nothing is
 * regrouped here. Ordinals are numbered across every selectable group, like
 * the web, so "Group 3" means the same group on every screen.
 */
export function DcsExamDuties({ examGroupId }: { examGroupId: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const groupsQ = useDcsGroups();
  const dutiesQ = useMyDuties(user?.id);
  const myDuties = useMemo(() => dutiesQ.data ?? [], [dutiesQ.data]);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const selection = useSelectionSet(dcsId);

  const blockers = useMemo(
    () => ({ selected: selection.selected.map(dcsGroupWindow), myDuties }),
    [selection.selected, myDuties],
  );

  // Hide completed / released groups with the shared lifecycle filter.
  const allGroups = useMemo(
    () =>
      selectableFilter(groupsQ.data ?? [], (g) => ({
        date: g.schedule.date,
        startTime: g.schedule.startTime,
        endTime: g.schedule.endTime,
        cancelled: g.status === "released",
      })),
    [groupsQ.data],
  );
  const ordinalMap = useMemo(() => buildDcsGroupOrdinalMap(allGroups), [allGroups]);
  const examGroups = useMemo(
    () => buildDcsGroups(allGroups.filter((g) => g.examGroup?._id === examGroupId)),
    [allGroups, examGroupId],
  );

  const dayChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of examGroups) seen.set(dayKey(g.schedule.date), formatDate(g.schedule.date));
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, label]) => ({ key, label }));
  }, [examGroups]);

  const visible = useMemo(
    () =>
      examGroups.filter((g) => {
        if (activeDay && dayKey(g.schedule.date) !== activeDay) return false;
        if (availableOnly) {
          const st = dcsStateOf(g, user?.id, selection.ids, blockers);
          if (st !== "AVAILABLE" && st !== "SELECTED") return false;
        }
        return true;
      }),
    [examGroups, activeDay, availableOnly, user?.id, selection.ids, blockers],
  );

  const sections = useMemo(() => sectionizeByWindow(visible, (g) => g.schedule), [visible]);

  const banner = useMemo(() => {
    const pool = visible.filter((g) => g.status !== "claimed" && !selection.ids.has(g._id)).map(dcsGroupWindow);
    return summarizeConflicts(pool, blockers);
  }, [visible, selection.ids, blockers]);

  const labelOf = useCallback((g: DcsGroup) => `DCS Group ${ordinalMap.get(g._id) ?? g.groupIndex}`, [ordinalMap]);

  const runner = useClaimRunner<DcsGroup>({
    claimOne: (g) => claimDcsGroup(g._id),
    labelOf,
    onDone: selection.clear,
  });

  const toggle = useCallback(
    (group: DcsGroup) => {
      if (selection.ids.has(group._id)) {
        selection.remove(group._id);
        return;
      }
      const v = dcsValidate(group, user?.id, selection.ids, blockers);
      if (!v.ok) {
        Alert.alert("Can't select this group", v.reason || "Cannot select this group.");
        return;
      }
      selection.add(group);
    },
    [selection, blockers, user?.id],
  );

  const confirmClaim = useCallback(() => {
    const items = selection.selected;
    const lines = items
      .map((g) => {
        const buildings = [...new Set(g.assignedRooms.map((r) => r.room.building?.name).filter(Boolean))].join(", ");
        return `• ${labelOf(g)} — ${formatDate(g.schedule.date)}, ${formatTimeRange(
          g.schedule.startTime,
          g.schedule.endTime,
        )}\n   ${buildings ? `${buildings}: ` : ""}rooms ${g.assignedRooms.map((r) => r.room.roomNumber).join(", ")}`;
      })
      .join("\n");
    const exam = items[0]?.examGroup;
    Alert.alert(
      items.length === 1 ? "Claim this DCS group?" : `Claim ${items.length} DCS groups?`,
      `${exam ? `${exam.examType} · Sem ${exam.semester}\n\n` : ""}${lines}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Claim", onPress: () => runner.run(items) },
      ],
    );
  }, [selection.selected, runner, labelOf]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: KEYS.dcsGroups }),
      queryClient.invalidateQueries({ queryKey: ["shared", "duties-by-teacher"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  return (
    <ClaimSectionList
      sections={sections}
      keyOf={dcsId}
      renderCard={(g) => (
        <DcsGroupCard
          group={g}
          ordinal={ordinalMap.get(g._id)}
          state={dcsStateOf(g, user?.id, selection.ids, blockers)}
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
      loading={groupsQ.isLoading || dutiesQ.isLoading}
      error={groupsQ.error || dutiesQ.error}
      onRetry={onRefresh}
      emptyMessage={
        availableOnly || activeDay ? "No groups match these filters." : "No selectable DCS groups left in this exam."
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
