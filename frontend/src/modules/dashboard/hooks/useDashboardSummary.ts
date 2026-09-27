import {
  useExamGroups,
  useAssignmentClassRows,
} from "@/modules/shared/exams/hooks/useSharedExamData";
import {
  getOngoingExams,
  getUpcomingExams,
  getCompletedExams,
  getDashboardAssignmentTarget,
  type DashboardAssignmentTarget,
} from "@/modules/shared/exams/selectors/dashboardSelectors";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";

export interface DashboardSummary {
  ongoingExams: ExamGroup[];
  upcomingExams: ExamGroup[];
  completedExams: ExamGroup[];
  /** Date-driven assignment-status target (tomorrow, else nearest future). */
  assignmentTarget: DashboardAssignmentTarget;
  /** Groups + duty slots both loaded. */
  isLoading: boolean;
  /** Exam groups (ongoing/upcoming/completed lists) still loading. */
  groupsLoading: boolean;
  /** Assignment target (duty slots) still loading. */
  assignmentLoading: boolean;
  error: unknown;
}

/**
 * Single composition point for every CS-dashboard summary widget. Pulls exam
 * groups (for ongoing/upcoming/completed) and the shared duty slots (for the
 * assignment target), then derives all figures via the centralized
 * `dashboardSelectors`. No business logic lives here — it only wires data.
 */
export function useDashboardSummary(): DashboardSummary {
  const groupsQuery = useExamGroups();
  const rowsQuery = useAssignmentClassRows();

  const groups = groupsQuery.data ?? [];
  const rows = rowsQuery.data ?? [];
  const now = new Date();

  return {
    ongoingExams: getOngoingExams(groups),
    upcomingExams: getUpcomingExams(groups),
    completedExams: getCompletedExams(groups),
    assignmentTarget: getDashboardAssignmentTarget(rows, now),
    isLoading: groupsQuery.isLoading || rowsQuery.isLoading,
    groupsLoading: groupsQuery.isLoading,
    assignmentLoading: rowsQuery.isLoading,
    error: groupsQuery.error || rowsQuery.error,
  };
}
