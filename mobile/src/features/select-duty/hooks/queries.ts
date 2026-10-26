import { useQueries, useQuery } from "@tanstack/react-query";

import type { TeacherRole } from "@/lib/types";

import {
  fetchDutiesByTeacher,
  fetchExamDutyStatus,
  fetchExamGroupDetails,
  fetchExamGroups,
  fetchMyProgress,
  listDcsGroups,
} from "../api";
import {
  selectActiveExamGroups,
  selectDutySlotsForGroup,
  type AvailableDutySlot,
} from "../shared/examSelectors";
import { buildClassRowsForGroup, type ClassAssignmentRow } from "../shared/dashboardSelectors";

// Query keys mirror the web (frontend/src/modules/shared/exams/hooks/useSharedExamData.ts,
// dcs/select-duty/hooks/useDcsGroups.ts) so invalidation reads the same everywhere.
export const KEYS = {
  groups: ["shared", "exam-groups"] as const,
  details: (id: string) => ["shared", "exam-details", id] as const,
  dutyStatus: (id: string) => ["shared", "duty-status", id] as const,
  duties: (teacherId: string | undefined) => ["shared", "duties-by-teacher", teacherId, null] as const,
  dcsGroups: ["dcs", "groups"] as const,
  progress: (role: TeacherRole) => ["duty-calculation", "my-progress", role] as const,
};

/** Everything a successful (or raced) claim can change. */
export const CLAIM_INVALIDATIONS = [
  ["shared", "exam-groups"],
  ["shared", "exam-details"],
  ["shared", "duty-status"],
  ["shared", "duties-by-teacher"],
  ["dcs", "groups"],
  ["dcs", "my-groups"],
  ["duty-calculation"],
  ["my-units"],
] as const;

const STALE = 15_000;

export function useExamGroups() {
  return useQuery({ queryKey: KEYS.groups, queryFn: fetchExamGroups, staleTime: STALE });
}

/**
 * The viewer's duties across every role. Select Duty's conflict scan passes no
 * role, exactly like the web — one person can't staff two roles at once.
 */
export function useMyDuties(teacherId: string | undefined) {
  return useQuery({
    queryKey: KEYS.duties(teacherId),
    queryFn: () => fetchDutiesByTeacher(teacherId as string),
    enabled: Boolean(teacherId),
    staleTime: STALE,
  });
}

export function useDcsGroups(enabled = true) {
  return useQuery({ queryKey: KEYS.dcsGroups, queryFn: listDcsGroups, staleTime: STALE, enabled });
}

export function useMyProgress(role: TeacherRole | null) {
  return useQuery({
    queryKey: KEYS.progress(role as TeacherRole),
    queryFn: () => fetchMyProgress(role as TeacherRole),
    enabled: Boolean(role),
    staleTime: STALE,
  });
}

/**
 * All active exam groups + each one's details and duty status — the shared feed
 * behind Select Duty's slots and the CS dashboard's class rows (both ports of
 * web hooks over the same cache keys), so it's fetched once for both.
 */
function useExamGroupFeeds(enabled: boolean) {
  const groupsQuery = useQuery({
    queryKey: KEYS.groups,
    queryFn: fetchExamGroups,
    staleTime: STALE,
    enabled,
  });
  const activeGroups = groupsQuery.data ? selectActiveExamGroups(groupsQuery.data) : [];

  const detailsQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.details(g._id),
      queryFn: () => fetchExamGroupDetails(g._id),
      staleTime: STALE,
      enabled,
    })),
  });

  const dutyStatusQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.dutyStatus(g._id),
      queryFn: () => fetchExamDutyStatus(g._id),
      staleTime: STALE,
      enabled,
    })),
  });

  const isLoading =
    groupsQuery.isLoading ||
    detailsQueries.some((q) => q.isLoading) ||
    dutyStatusQueries.some((q) => q.isLoading);

  const error =
    groupsQuery.error ||
    detailsQueries.find((q) => q.error)?.error ||
    dutyStatusQueries.find((q) => q.error)?.error ||
    null;

  // Whatever is cached, per group (like the web), so a transient background-
  // refetch error doesn't blank a list mid-use.
  const feeds = activeGroups.flatMap((group, i) => {
    const details = detailsQueries[i]?.data;
    const dutyStatus = dutyStatusQueries[i]?.data;
    return details && dutyStatus ? [{ group, details, dutyStatus }] : [];
  });

  return { feeds, activeGroups, isLoading, error, refetchGroups: groupsQuery.refetch };
}

/**
 * Port of useAvailableDutySlots (web): one slot per (schedule × examRoom).
 * Same cache keys, so a claim's invalidation refreshes every consumer.
 */
export function useAvailableDutySlots(enabled = true) {
  const { feeds, activeGroups, isLoading, error, refetchGroups } = useExamGroupFeeds(enabled);
  const slots: AvailableDutySlot[] = feeds.flatMap(selectDutySlotsForGroup);
  return { data: slots, activeGroups, isLoading, error, refetchGroups };
}

/**
 * Port of useAssignmentClassRows (web): one row per (schedule × classroom) with
 * duty flags + status, for the CS dashboard's assignment-status counts.
 */
export function useAssignmentClassRows(enabled = true) {
  const { feeds, activeGroups, isLoading, error, refetchGroups } = useExamGroupFeeds(enabled);
  const rows: ClassAssignmentRow[] = feeds.flatMap(buildClassRowsForGroup);
  return { data: rows, activeGroups, isLoading, error, refetchGroups };
}
