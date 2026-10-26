import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { CLAIM_INVALIDATIONS, useAvailableDutySlots, useMyDuties } from "@/features/select-duty/hooks/queries";
import { buildDcsGroups } from "@/features/select-duty/shared/dcsGroupingService";
import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";
import type { Duty } from "@/features/select-duty/shared/dutyTypes";
import { groupRoomsIntoRSGroups } from "@/features/select-duty/shared/rsDutyGroupingUtils";
import type { RSDutyGroup } from "@/features/select-duty/shared/rsTypes";
import type { TeacherRole } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

import {
  createChangeRequest,
  fetchAllChangeRequests,
  fetchMyChangeRequests,
  fetchMyDcsGroups,
  fetchOpenDcsGroups,
  fetchReplacementSlots,
  reviewChangeRequest,
} from "./api";
import { filterUpcomingRSDuties, groupRSDutiesIntoUpcomingGroups } from "./shared/rsUpcomingGrouping";
import type { ChangeRequest, CreateChangeRequestPayload } from "./types";
import { isDcsGroupUpcoming, upcomingAssignedDuties } from "./validation";

// Query keys match the web (shared/change-requests/hooks/useChangeRequests.ts,
// dcs/change-requests/hooks/useDcsChangeRequests.ts) so invalidation reads the
// same everywhere.
export const CR_KEYS = {
  all: ["change-requests"] as const,
  byStatus: (status: string) => ["change-requests", "all", status] as const,
  mine: ["change-requests", "mine"] as const,
  replacements: (dutyId: string) => ["change-requests", "replacements", dutyId] as const,
  myDcsGroups: ["dcs", "my-groups"] as const,
  openDcsGroups: ["dcs", "groups", "open"] as const,
};

/** Which request scope belongs to which role's page. */
const SCOPE_OF: Record<TeacherRole, string> = { invigilator: "duty", rs: "rs_group", dcs: "dcs_group" };
export const requestRole = (r: ChangeRequest): TeacherRole =>
  r.scope === "dcs_group" || r.type === "dcs_swap" ? "dcs" : r.scope === "rs_group" || r.type === "rs_swap" ? "rs" : "invigilator";

/** Everything the signed-in teacher has asked for, newest first. Always refetched on open. */
export function useMyChangeRequests() {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: CR_KEYS.mine, queryFn: fetchMyChangeRequests, enabled: !!token, staleTime: 0 });
}

/** My requests narrowed to one role's scope, split pending / decided like the web pages. */
export function useRoleRequests(role: TeacherRole | null) {
  const query = useMyChangeRequests();
  const split = useMemo(() => {
    const all = query.data ?? [];
    const mine = role ? all.filter((r) => (r.scope ?? SCOPE_OF[requestRole(r)]) === SCOPE_OF[role]) : all;
    return { pending: mine.filter((r) => r.status === "pending"), decided: mine.filter((r) => r.status !== "pending") };
  }, [query.data, role]);
  return { ...query, ...split };
}

/**
 * The viewer's duties: `all` spans every role (conflict checks — the backend's
 * submit checks span all roles too) and `forRole` is one role's slice, the way
 * the web's useDutiesByTeacher(userId, role) scopes a dashboard. One request:
 * GET /duties?teacher=<own id>.
 */
export function useDutiesForRole(role: TeacherRole | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useMyDuties(userId);
  const all = useMemo<Duty[]>(() => query.data ?? [], [query.data]);
  const forRole = useMemo(() => (role ? all.filter((d) => (d.role ?? "invigilator") === role) : []), [all, role]);
  return { ...query, all, forRole };
}

/** Invigilator: upcoming assigned duties eligible for a move. */
export function useInvigilatorSources(enabled: boolean) {
  const duties = useDutiesForRole(enabled ? "invigilator" : null);
  const sources = useMemo(() => upcomingAssignedDuties(duties.forRole), [duties.forRole]);
  return { ...duties, sources };
}

/** RS: the viewer's upcoming RS groups, re-derived from their duties exactly like the web page. */
export function useRsSources(enabled: boolean) {
  const duties = useDutiesForRole(enabled ? "rs" : null);
  const sources = useMemo(() => groupRSDutiesIntoUpcomingGroups(filterUpcomingRSDuties(duties.forRole)), [duties.forRole]);
  return { ...duties, sources };
}

/** DCS: the viewer's claimed DCS groups, today or later. */
export function useDcsSources(enabled: boolean) {
  const token = useAuthStore((s) => s.token);
  const query = useQuery({
    queryKey: CR_KEYS.myDcsGroups,
    queryFn: async () => buildDcsGroups(await fetchMyDcsGroups()),
    enabled: enabled && !!token,
    staleTime: 15_000,
  });
  const owned = useMemo<DcsGroup[]>(() => query.data ?? [], [query.data]);
  const sources = useMemo(() => owned.filter(isDcsGroupUpcoming), [owned]);
  return { ...query, owned, sources };
}

export function useReplacementSlots(dutyId: string | null) {
  return useQuery({
    queryKey: CR_KEYS.replacements(dutyId as string),
    queryFn: () => fetchReplacementSlots(dutyId as string),
    enabled: Boolean(dutyId),
    staleTime: 0,
  });
}

/** Every RS group derivable from active exams — the same pipeline as RS Select Duty (web useAvailableRsGroups). */
export function useAvailableRsGroups(enabled: boolean) {
  const qc = useQueryClient();
  const slots = useAvailableDutySlots(enabled);
  const groups = useMemo<RSDutyGroup[]>(() => groupRoomsIntoRSGroups(slots.data ?? []), [slots.data]);
  // Pull-to-refresh: re-read every exam's rooms and occupancy, not just the exam list.
  const refetch = () =>
    Promise.all(
      [["shared", "exam-groups"], ["shared", "exam-details"], ["shared", "duty-status"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );
  return { groups, isLoading: slots.isLoading, error: slots.error, refetch };
}

export function useOpenDcsGroups(enabled: boolean) {
  return useQuery({
    queryKey: CR_KEYS.openDcsGroups,
    queryFn: async () => buildDcsGroups(await fetchOpenDcsGroups()),
    enabled,
    staleTime: 0,
  });
}

/**
 * Submit any request type. Afterwards refresh everything a request (or a later
 * approval) can touch — requests, duties, my-units, DCS groups, progress — the
 * web's invalidateAll plus the app's my-units list.
 */
export function useSubmitChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChangeRequestPayload) => createChangeRequest(payload),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CR_KEYS.all });
      for (const key of CLAIM_INVALIDATIONS) void qc.invalidateQueries({ queryKey: [...key] });
    },
  });
}

// ── CS review ───────────────────────────────────────────────────────────────

export type ReviewStatus = "pending" | "approved" | "rejected";

/** CS: the review queue for one status (web useAllChangeRequests). */
export function useAllChangeRequests(status: ReviewStatus) {
  const token = useAuthStore((s) => s.token);
  const isCs = useAuthStore((s) => s.user?.activeRole === "cs");
  return useQuery({
    queryKey: CR_KEYS.byStatus(status),
    queryFn: () => fetchAllChangeRequests(status),
    enabled: !!token && isCs,
  });
}

/** CS: approve / reject. Like the web, refreshes requests and the duty caches a swap can move. */
export function useReviewChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) => reviewChangeRequest(v.id, v.action, v.note),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: CR_KEYS.all }),
        qc.invalidateQueries({ queryKey: ["shared"] }),
        qc.invalidateQueries({ queryKey: ["dcs"] }),
      ]);
    },
  });
}
