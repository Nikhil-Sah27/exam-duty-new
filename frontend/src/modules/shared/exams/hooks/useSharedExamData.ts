import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchExamGroups,
  fetchExamGroupDetails,
  fetchExamDutyStatus,
  fetchDutiesByTeacher,
} from "../services/examQueryService";
import {
  selectActiveExamGroups,
  selectDutySlotsForGroup,
  type AvailableDutySlot,
} from "../selectors/examSelectors";
import {
  buildClassRowsForGroup,
  type ClassAssignmentRow,
} from "../selectors/dashboardSelectors";

const KEYS = {
  groups: ["shared", "exam-groups"] as const,
  details: (id: string) => ["shared", "exam-details", id] as const,
  dutyStatus: (id: string) => ["shared", "duty-status", id] as const,
  duties: (teacherId: string | undefined, role?: string) =>
    ["shared", "duties-by-teacher", teacherId, role ?? null] as const,
};

export function useExamGroups() {
  return useQuery({ queryKey: KEYS.groups, queryFn: fetchExamGroups });
}

export function useExamGroupDetails(groupId: string | null) {
  return useQuery({
    queryKey: KEYS.details(groupId as string),
    queryFn: () => fetchExamGroupDetails(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useExamDutyStatus(groupId: string | null) {
  return useQuery({
    queryKey: KEYS.dutyStatus(groupId as string),
    queryFn: () => fetchExamDutyStatus(groupId as string),
    enabled: Boolean(groupId),
  });
}

/**
 * A teacher's duties, optionally scoped to one `role`. Operational dashboards
 * pass their active role so a multi-role teacher's invigilator and RS/DCS
 * duties stay in their own dashboards; CS views omit it to see every role.
 * Role is part of the query key, so the two scopes cache independently.
 */
export function useDutiesByTeacher(
  teacherId: string | undefined,
  role?: string,
) {
  return useQuery({
    queryKey: KEYS.duties(teacherId, role),
    queryFn: async () => {
      const data = await fetchDutiesByTeacher(teacherId as string, role);
      // Belt-and-suspenders: scope client-side too. A multi-role teacher's
      // invigilator and RS/DCS duties must never cross dashboards even if the
      // API ignores `role` (e.g. an un-restarted backend). Callers that want
      // every role (CS views, Select Duty conflict scans) pass no role.
      return role ? data.filter((d) => (d.role ?? "invigilator") === role) : data;
    },
    enabled: Boolean(teacherId),
  });
}

/**
 * Compose all active exam groups + per-group details + duty status into
 * a flat list of duty slots. Used by Select Duty.
 *
 * React Query handles per-group caching automatically; refetching one group's
 * details only invalidates its key, not the whole list.
 */
export function useAvailableDutySlots() {
  const groupsQuery = useExamGroups();
  const activeGroups = groupsQuery.data
    ? selectActiveExamGroups(groupsQuery.data)
    : [];

  const detailsQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.details(g._id),
      queryFn: () => fetchExamGroupDetails(g._id),
    })),
  });

  const dutyStatusQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.dutyStatus(g._id),
      queryFn: () => fetchExamDutyStatus(g._id),
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

  const slots: AvailableDutySlot[] = [];
  if (!isLoading && !error) {
    for (let i = 0; i < activeGroups.length; i++) {
      const details = detailsQueries[i].data;
      const dutyStatus = dutyStatusQueries[i].data;
      if (!details || !dutyStatus) continue;
      slots.push(
        ...selectDutySlotsForGroup({
          group: activeGroups[i],
          details,
          dutyStatus,
        })
      );
    }
  }

  return { data: slots, isLoading, error };
}

/**
 * Class-level rows (one per schedule × classroom) with duty flags + status and
 * the raw schedule/room objects. Same fetch + cache keys as
 * `useAvailableDutySlots` (so a CS assignment's `["shared"]` invalidation
 * refetches this too), but shaped for the CS dashboard's assignment-status
 * count + drill-down. Both consume `buildClassRowsForGroup`, so the count and
 * the list are always the identical dataset.
 */
export function useAssignmentClassRows() {
  const groupsQuery = useExamGroups();
  const activeGroups = groupsQuery.data
    ? selectActiveExamGroups(groupsQuery.data)
    : [];

  const detailsQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.details(g._id),
      queryFn: () => fetchExamGroupDetails(g._id),
    })),
  });

  const dutyStatusQueries = useQueries({
    queries: activeGroups.map((g) => ({
      queryKey: KEYS.dutyStatus(g._id),
      queryFn: () => fetchExamDutyStatus(g._id),
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

  // Build from whatever per-group data is cached, regardless of a transient
  // refetch error on any single fan-out query. React Query retains the last
  // good `data` during a background-refetch error, so the row list (and any
  // open assignment modal keyed off it) stays stable instead of collapsing to
  // empty. `isLoading` / `error` are still surfaced so callers render the
  // right chrome (skeleton, or an error only when nothing loaded at all).
  const rows: ClassAssignmentRow[] = [];
  for (let i = 0; i < activeGroups.length; i++) {
    const details = detailsQueries[i].data;
    const dutyStatus = dutyStatusQueries[i].data;
    if (!details || !dutyStatus) continue;
    rows.push(
      ...buildClassRowsForGroup({
        group: activeGroups[i],
        details,
        dutyStatus,
      })
    );
  }

  return { data: rows, isLoading, error };
}
