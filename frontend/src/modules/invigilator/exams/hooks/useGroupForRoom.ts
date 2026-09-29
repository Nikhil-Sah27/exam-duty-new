import { useMemo } from "react";
import { useDcsGroups } from "@/modules/dcs/select-duty/hooks/useDcsGroups";
import { useAvailableDutySlots } from "@/modules/shared/exams/hooks/useSharedExamData";
import { useRSDutyGrouping } from "@/modules/rs/select-duty/hooks/useRSDutyGrouping";
import { EMPTY_RS_FILTERS } from "@/modules/rs/select-duty/types";
import { buildDcsGroupOrdinalMap } from "@/modules/duties/services/dcsGroupingService";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import type { RSDutyGroup } from "@/modules/rs/select-duty/types";
import type { OperationalRoleKey } from "@/modules/shared/utils/assignmentStatusUtils";

/**
 * Resolve "which group does this room belong to" for the viewer's role.
 *
 * DCS groups are persisted (one DCSGroup doc per schedule × chunk) so we
 * find them by `assignedRooms[].._id === examRoomId`. RS groups are derived
 * client-side from the same grouping algorithm used by the RS Select Duty
 * page — we never reimplement the chunking here, just consume what
 * `useRSDutyGrouping` already produces and filter to the group containing
 * the room.
 *
 * Invigilator never has a group — the hook returns `null` for that role so
 * the classroom modal renders the per-room flow unchanged.
 */
export type DutyGroupKind = "DCS" | "RS";

export interface DutyGroupForRoomResult {
  kind: DutyGroupKind | null;
  dcsGroup?: DcsGroup | null;
  rsGroup?: RSDutyGroup | null;
  /**
   * Cross-schedule display number for the DCS group, computed against ALL
   * visible DCS groups. Unique per group; null when the viewer isn't DCS or
   * no match was found. Backend `groupIndex` resets per schedule and is
   * insufficient for a stable global label.
   */
  dcsDisplayOrdinal?: number | null;
  isLoading: boolean;
}

interface UseGroupForRoomArgs {
  viewerRole: OperationalRoleKey;
  examRoomId: string | null;
  scheduleId: string | null;
}

export function useGroupForRoom({
  viewerRole,
  examRoomId,
  scheduleId,
}: UseGroupForRoomArgs): DutyGroupForRoomResult {
  // DCS: query the persisted DCS groups. Returning all groups is fine —
  // the cache is shared with Select Duty so we don't duplicate fetches.
  const dcsQuery = useDcsGroups();

  // RS: derive groups from the same slot pipeline + grouping utility the
  // RS Select Duty page uses. Filters are empty so the full grouping is
  // available; we then pick the one containing our examRoom.
  const slotsQuery = useAvailableDutySlots();
  const { groups: rsGroups } = useRSDutyGrouping(
    viewerRole === "rs" ? slotsQuery.data : [],
    EMPTY_RS_FILTERS,
  );

  return useMemo(() => {
    if (!examRoomId || !scheduleId) {
      return { kind: null, isLoading: false };
    }

    if (viewerRole === "dcs") {
      const data = dcsQuery.data ?? [];
      const match = data.find(
        (g) =>
          g.schedule._id === scheduleId &&
          g.assignedRooms.some((r) => r._id === examRoomId),
      );
      const ordinals = buildDcsGroupOrdinalMap(data);
      return {
        kind: "DCS",
        dcsGroup: match ?? null,
        dcsDisplayOrdinal: match ? (ordinals.get(match._id) ?? null) : null,
        isLoading: dcsQuery.isLoading,
      };
    }

    if (viewerRole === "rs") {
      const match = rsGroups.find(
        (g) =>
          g.scheduleId === scheduleId &&
          g.rooms.some((r) => r.examRoomId === examRoomId),
      );
      return {
        kind: "RS",
        rsGroup: match ?? null,
        isLoading: slotsQuery.isLoading,
      };
    }

    return { kind: null, isLoading: false };
    // The dependency list intentionally includes the underlying data refs:
    // both the query data and the grouping output are memoised already.
  }, [
    examRoomId,
    scheduleId,
    viewerRole,
    dcsQuery.data,
    dcsQuery.isLoading,
    rsGroups,
    slotsQuery.isLoading,
  ]);
}
