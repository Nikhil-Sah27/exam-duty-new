import { useMemo } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import {
  buildRSUpcomingSummary,
  filterUpcomingRSDuties,
  groupRSDutiesIntoUpcomingGroups,
} from "../utils/rsUpcomingGrouping";

/**
 * Reuses the shared `useDutiesByTeacher` query so RS Upcoming Duties shares a
 * cache with the invigilator paths — invalidations from Select Duty refresh
 * this view without extra plumbing.
 */
export function useRSUpcomingGroups() {
  const userId = useAuthStore((s) => s.user?.id);
  const dutiesQuery = useDutiesByTeacher(userId, "rs");

  const upcoming = useMemo(
    () => filterUpcomingRSDuties(dutiesQuery.data ?? []),
    [dutiesQuery.data],
  );

  const groups = useMemo(
    () => groupRSDutiesIntoUpcomingGroups(upcoming),
    [upcoming],
  );

  const summary = useMemo(() => buildRSUpcomingSummary(groups), [groups]);

  return {
    duties: upcoming,
    groups,
    summary,
    isLoading: dutiesQuery.isLoading,
    error: dutiesQuery.error,
  };
}
