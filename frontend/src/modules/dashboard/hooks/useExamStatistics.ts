import { useExamGroups } from "@/modules/shared/exams/hooks/useSharedExamData";
import { useInstitutionDutySummary } from "@/modules/duty-calculation/hooks/useDutyProgress";
import type { InstitutionDutySummary } from "@/modules/duty-calculation/types";

export interface ExamStatistics {
  /** Total exam groups recorded in the system. */
  scheduledExams: number;
  /** Institution-wide student total (Σ Semester.studentCount). */
  totalStudents: number;
  studentsLoading: boolean;
}

/** Σ per-semester studentCount across every department — the institution total. */
function sumStudents(institution?: InstitutionDutySummary): number {
  if (!institution) return 0;
  return institution.departments.reduce(
    (deptSum, d) =>
      deptSum +
      d.semesters.reduce((semSum, s) => semSum + (s.breakdown.students || 0), 0),
    0,
  );
}

/**
 * Statistics shown in the dashboard's no-assignment (State C) view. Reuses the
 * existing centralized sources — `useExamGroups` for the scheduled-exam count
 * and the duty-calculation institution summary for the student total — so no
 * counting logic is duplicated. Intentionally consumed only by
 * <ExamStatisticsSection>, which mounts only in State C, so the heavier
 * institution query never fires in the assignment-status states.
 */
export function useExamStatistics(): ExamStatistics {
  const groupsQuery = useExamGroups();
  const institutionQuery = useInstitutionDutySummary();

  return {
    scheduledExams: (groupsQuery.data ?? []).length,
    totalStudents: sumStudents(institutionQuery.data?.institution),
    studentsLoading: institutionQuery.isLoading,
  };
}
