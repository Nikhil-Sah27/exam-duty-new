import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useExamGroups,
  examDetailsQueryKey,
} from "@/modules/shared/exams/hooks/useSharedExamData";
import { fetchExamGroupDetails } from "@/modules/shared/exams/services/examQueryService";
import { getUpcomingExams } from "@/modules/shared/exams/selectors/dashboardSelectors";
import type {
  ExamGroup,
  ExamGroupDetails,
  ExamGroupType,
} from "@/modules/shared/exams/types/exam.types";
import { buildExamDayMapFromSchedules } from "../utils/examPopupUtils";

export interface UpcomingExamPopupData {
  /** Upcoming exam groups, nearest-first (from the centralized selector). */
  exams: ExamGroup[];
  /**
   * Actual exam days → exam types held that day, built from each group's real
   * schedule dates (not the start/end span). Drives the calendar dots.
   */
  examDays: Map<string, ExamGroupType[]>;
  hasExams: boolean;
  isLoading: boolean;
}

/**
 * Data source for the Upcoming Exams popup. Reuses the shared `useExamGroups`
 * query (same react-query cache as the rest of the dashboard — no extra
 * request) and the centralized `getUpcomingExams` selector, so this popup never
 * introduces a parallel exam-data system.
 *
 * The calendar must dot only days that actually hold an exam, so we also fetch
 * each upcoming group's details (through the shared `exam-details` cache key)
 * and index their individual schedule dates.
 */
export function useUpcomingExamPopup(): UpcomingExamPopupData {
  const { data, isLoading } = useExamGroups();
  const exams = useMemo(() => getUpcomingExams(data ?? []), [data]);

  const detailsQueries = useQueries({
    queries: exams.map((g) => ({
      queryKey: examDetailsQueryKey(g._id),
      queryFn: () => fetchExamGroupDetails(g._id),
    })),
  });

  const detailsLoading = detailsQueries.some((q) => q.isLoading);
  const loadedDetails = useMemo(
    () =>
      detailsQueries
        .map((q) => q.data)
        .filter((d): d is ExamGroupDetails => Boolean(d)),
    [detailsQueries],
  );

  const examDays = useMemo(
    () => buildExamDayMapFromSchedules(loadedDetails),
    [loadedDetails],
  );

  return {
    exams,
    examDays,
    hasExams: exams.length > 0,
    isLoading: isLoading || detailsLoading,
  };
}
