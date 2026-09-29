import { useMemo } from "react";
import type { ExamGroup } from "../types/exam.types";
import {
  groupExamsByStatusThenType,
  type ExamStatusGroup,
} from "../utils/examSortUtils";

export interface UseGroupedExamsOptions {
  /** Optional exam-type filter: `""` / undefined = all, otherwise one of IA1|IA2|IA3|SEE. */
  selectedType?: string;
  /** Optional semester filter ("" / undefined = all). */
  selectedSemester?: string | number;
}

export interface GroupedExams {
  /**
   * Exams grouped Status → Type: Ongoing → Upcoming → Completed at the top
   * level, SEE → IA1 → IA2 → IA3 within each status. Empty bands are omitted.
   */
  statusGroups: ExamStatusGroup[];
  /** Total exams left after filters (across all bands). */
  total: number;
}

/**
 * Centralized exam-grouping hook used by every view that lists exam groups
 * (CS Exams page, Invigilator/RS Exams, assign-duty flow). Applies optional
 * type + semester filtering, then groups the survivors Status → Type via
 * `groupExamsByStatusThenType`. Pure / memoized — safe to call every render.
 */
export function useGroupedExams(
  exams: ExamGroup[] | undefined,
  { selectedType = "", selectedSemester = "" }: UseGroupedExamsOptions = {},
): GroupedExams {
  return useMemo(() => {
    const list = exams ?? [];

    const filtered = list.filter((g) => {
      if (selectedType && g.examType !== selectedType) return false;
      if (selectedSemester !== "" && selectedSemester !== undefined) {
        const sem =
          typeof selectedSemester === "string"
            ? Number(selectedSemester)
            : selectedSemester;
        if (!Number.isNaN(sem) && sem !== 0 && g.semester !== sem) return false;
      }
      return true;
    });

    return {
      statusGroups: groupExamsByStatusThenType(filtered),
      total: filtered.length,
    };
  }, [exams, selectedType, selectedSemester]);
}
