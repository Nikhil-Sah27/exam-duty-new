import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDcsDutyGroups,
  getDcsGroupAssignments,
  hasTimeConflict,
  type DcsDutyGroup,
} from "@/modules/duties/services/dcsGroupingService";
import {
  submitDcsGroupSwap,
  type SubmitDcsSwapPayload,
} from "../services/dcsChangeRequestService";
import { getTeacherChangeRequests } from "@/modules/shared/change-requests/services/changeRequestService";
import type { ChangeRequest } from "@/modules/shared/change-requests/types/changeRequest.types";

const KEYS = {
  myAssignments: ["dcs", "my-groups"] as const,
  openGroups: ["dcs", "groups", "open"] as const,
  myRequests: ["change-requests", "mine"] as const,
};

/**
 * The viewer's claimed DCS groups — the cards on which "Request Change" is
 * surfaced. Shares its cache key with the existing Upcoming Duties query so
 * a swap approval propagates everywhere without manual invalidation.
 */
export const useMyDcsGroupAssignments = () => {
  return useQuery({
    queryKey: KEYS.myAssignments,
    queryFn: getDcsGroupAssignments,
    staleTime: 30_000,
  });
};

/**
 * Available swap targets — open DCS groups minus the viewer's own and minus
 * anything that would create a time conflict with their other commitments.
 */
export const useDcsSwapTargets = (
  sourceGroupId: string | null,
  viewerOwnedGroups: DcsDutyGroup[]
) => {
  const query = useQuery({
    queryKey: KEYS.openGroups,
    queryFn: () => getDcsDutyGroups({ status: "open" }),
    enabled: Boolean(sourceGroupId),
    staleTime: 30_000,
  });

  const filtered = useMemo<DcsDutyGroup[]>(() => {
    if (!query.data) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Blockers = the user's other claimed groups (excluding the source they're
    // swapping out of). Mirrors the backend's submit-time conflict check.
    const blockers = viewerOwnedGroups
      .filter((g) => g._id !== sourceGroupId)
      .map((g) => ({
        date: g.schedule.date,
        startTime: g.schedule.startTime,
        endTime: g.schedule.endTime,
      }));

    return query.data
      .filter((g) => g._id !== sourceGroupId)
      .filter((g) => {
        const d = new Date(g.schedule.date);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .filter((g) => !hasTimeConflict(g, blockers));
  }, [query.data, sourceGroupId, viewerOwnedGroups]);

  return { ...query, data: filtered };
};

/**
 * The viewer's outstanding DCS swap requests. Pulled from the shared "mine"
 * endpoint and narrowed to dcs_group scope so the DCS page can list its own
 * pending/history separately from any per-duty requests they may have.
 */
export const useMyDcsChangeRequests = () => {
  const query = useQuery({
    queryKey: KEYS.myRequests,
    queryFn: getTeacherChangeRequests,
  });

  const dcsRequests = useMemo<ChangeRequest[]>(() => {
    return (query.data ?? []).filter(
      (r) => r.scope === "dcs_group" || r.type === "dcs_swap"
    );
  }, [query.data]);

  return { ...query, data: dcsRequests };
};

/**
 * Submit a DCS swap. Invalidates the assignment, target list, and request
 * list caches so every surface refreshes after a successful submit.
 */
export const useSubmitDcsSwap = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitDcsSwapPayload) => submitDcsGroupSwap(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      qc.invalidateQueries({ queryKey: ["dcs"] });
    },
  });
};
