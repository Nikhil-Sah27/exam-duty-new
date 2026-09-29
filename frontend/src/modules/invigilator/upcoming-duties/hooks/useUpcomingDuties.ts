import { useMemo } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import {
  filterUpcomingDuties,
  groupUpcomingDuties,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";

/**
 * Single source for the Upcoming Duties view.
 *
 * Reuses the shared `useDutiesByTeacher` query so this module rides the same
 * cache as the Change Requests / Exams "Your Duty" highlight — selecting a
 * duty in the room modal invalidates the same key and this page refreshes.
 */
export function useUpcomingDuties() {
  const userId = useAuthStore((s) => s.user?.id);
  const dutiesQuery = useDutiesByTeacher(userId);

  const upcoming = useMemo(
    () => filterUpcomingDuties(dutiesQuery.data ?? []),
    [dutiesQuery.data]
  );

  const groups = useMemo(() => groupUpcomingDuties(upcoming), [upcoming]);

  return {
    duties: upcoming,
    groups,
    isLoading: dutiesQuery.isLoading,
    error: dutiesQuery.error,
  };
}
