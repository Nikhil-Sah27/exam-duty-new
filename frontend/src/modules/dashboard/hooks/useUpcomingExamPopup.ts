import { useExamGroups } from "@/modules/shared/exams/hooks/useSharedExamData";
import { getUpcomingExams } from "@/modules/shared/exams/selectors/dashboardSelectors";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";

export interface UpcomingExamPopupData {
  /** Upcoming exam groups, nearest-first (from the centralized selector). */
  exams: ExamGroup[];
  hasExams: boolean;
  isLoading: boolean;
}

/**
 * Data source for the Upcoming Exams popup. Reuses the shared `useExamGroups`
 * query (same react-query cache as the rest of the dashboard — no extra
 * request) and the centralized `getUpcomingExams` selector, so this popup never
 * introduces a parallel exam-data system.
 */
export function useUpcomingExamPopup(): UpcomingExamPopupData {
  const { data, isLoading } = useExamGroups();
  const exams = getUpcomingExams(data ?? []);
  return { exams, hasExams: exams.length > 0, isLoading };
}
