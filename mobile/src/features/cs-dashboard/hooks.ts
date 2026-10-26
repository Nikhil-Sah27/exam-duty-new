import { useAssignmentClassRows, useExamGroups } from "@/features/select-duty/hooks/queries";
import {
  getDashboardAssignmentTarget,
  getOngoingExams,
  getUpcomingExams,
} from "@/features/select-duty/shared/dashboardSelectors";

/**
 * Everything the CS Home shows, from the same feeds + selectors as the web CS
 * dashboard (useDashboardSummary): ongoing / upcoming exams and the next exam
 * date's classroom assignment status. No business logic here — only wiring.
 */
export function useCsDashboard() {
  const groups = useExamGroups();
  const rows = useAssignmentClassRows();
  const all = groups.data ?? [];
  return {
    ongoing: getOngoingExams(all),
    upcoming: getUpcomingExams(all),
    target: getDashboardAssignmentTarget(rows.data),
    groupsLoading: groups.isLoading,
    targetLoading: rows.isLoading,
    error: groups.error || rows.error,
    refetch: () => Promise.allSettled([groups.refetch(), rows.refetchGroups()]),
    isRefetching: groups.isRefetching,
  };
}
