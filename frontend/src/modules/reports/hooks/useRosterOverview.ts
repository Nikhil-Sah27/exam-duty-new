import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useExamGroups } from "@/modules/exams/hooks";
import { fetchDuties } from "@/modules/duties/services";
import { useAllTeachersProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import {
  computeRoleEngagement,
  type RoleEngagement,
} from "@/modules/duty-calculation/utils/roleEngagement";
import type { TeacherDutyProgress } from "@/modules/duty-calculation/types";

export interface RosterCoverage {
  /** Invigilator "class" slots across all exams (one per exam room). */
  totalClasses: number;
  assigned: number;
  assignedCs: number;
  assignedSelf: number;
  vacant: number;
}

export interface RosterOverviewData {
  coverage: RosterCoverage;
  roleCompletion: RoleEngagement[];
  teachers: TeacherDutyProgress[];
  isLoading: boolean;
  error: unknown;
}

/**
 * Institution-wide analytics for the Reports empty state (no exam selected).
 * Composed entirely from existing reads so the numbers can never disagree with
 * the roster, the workload table, or the dashboards:
 *  - exam groups give the total class (room) slots,
 *  - the duty list gives CS-vs-self assignment split + vacancy,
 *  - the per-teacher cohort gives per-role completion + the low-performer list.
 */
export function useRosterOverview(): RosterOverviewData {
  const groupsQuery = useExamGroups();
  const dutiesQuery = useQuery({
    queryKey: ["duties", "all"],
    queryFn: fetchDuties,
    staleTime: 30_000,
  });
  const teachersQuery = useAllTeachersProgress();

  const coverage = useMemo<RosterCoverage>(() => {
    const groups = groupsQuery.data ?? [];
    const duties = dutiesQuery.data ?? [];
    const totalClasses = groups.reduce((s, g) => s + (g.totalRooms ?? 0), 0);
    const invigilator = duties.filter(
      (d) => d.role === "invigilator" && d.status !== "cancelled",
    );
    const assigned = invigilator.length;
    const assignedCs = invigilator.filter((d) => !d.isSelfAssigned).length;
    const assignedSelf = assigned - assignedCs;
    const vacant = Math.max(0, totalClasses - assigned);
    return { totalClasses, assigned, assignedCs, assignedSelf, vacant };
  }, [groupsQuery.data, dutiesQuery.data]);

  const teachers = teachersQuery.data?.teachers ?? [];

  const roleCompletion = useMemo(
    () => computeRoleEngagement(teachers),
    [teachers],
  );

  return {
    coverage,
    roleCompletion,
    teachers,
    isLoading:
      groupsQuery.isLoading || dutiesQuery.isLoading || teachersQuery.isLoading,
    error: groupsQuery.error || dutiesQuery.error || teachersQuery.error,
  };
}
