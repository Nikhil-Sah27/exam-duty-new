import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllTeachersProgress,
  fetchInstitutionDutySummary,
  fetchMyDutyProgress,
  fetchMyRsDutyProgress,
  fetchMyDcsDutyProgress,
  fetchTeacherDutyProgress,
  type AllTeachersFilters,
} from "../services/dutyCalculationApi";

/**
 * Central query keys for the duty-calculation module. Grouped under a single
 * root so cross-cutting mutations (teacher CRUD, exam creation, etc.) can
 * invalidate every derived read with one `invalidateQueries({ queryKey:
 * DUTY_CALC_ROOT })`.
 */
export const DUTY_CALC_ROOT = ["duty-calculation"] as const;

export const DUTY_CALC_KEYS = {
  root: DUTY_CALC_ROOT,
  myProgress: [...DUTY_CALC_ROOT, "my-progress"] as const,
  myRsProgress: [...DUTY_CALC_ROOT, "my-rs-progress"] as const,
  myDcsProgress: [...DUTY_CALC_ROOT, "my-dcs-progress"] as const,
  teacherProgress: (id: string) =>
    [...DUTY_CALC_ROOT, "teacher-progress", id] as const,
  allTeachers: (filters: AllTeachersFilters) =>
    [...DUTY_CALC_ROOT, "all-teachers", filters] as const,
  institution: [...DUTY_CALC_ROOT, "institution"] as const,
};

/** Widget hook for the invigilator dashboard. */
export function useMyDutyProgress() {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.myProgress,
    queryFn: fetchMyDutyProgress,
    staleTime: 30_000,
  });
}

/**
 * Widget hook for the RS dashboard. Shares the `duty-calculation` root key, so
 * every mutation that already invalidates duty targets (teacher CRUD, dept /
 * semester / course changes) auto-refreshes this too — no extra wiring.
 */
export function useMyRsDutyProgress() {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.myRsProgress,
    queryFn: fetchMyRsDutyProgress,
    staleTime: 30_000,
  });
}

/**
 * Widget hook for the DCS dashboard. Shares the `duty-calculation` root key, so
 * teacher / department / semester / course mutations auto-refresh it — no extra
 * wiring, same as the invigilator and RS widgets.
 */
export function useMyDcsDutyProgress() {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.myDcsProgress,
    queryFn: fetchMyDcsDutyProgress,
    staleTime: 30_000,
  });
}

export function useTeacherDutyProgress(teacherId: string | null | undefined) {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.teacherProgress((teacherId as string) || ""),
    queryFn: () => fetchTeacherDutyProgress(teacherId as string),
    enabled: Boolean(teacherId),
    staleTime: 30_000,
  });
}

export function useAllTeachersProgress(filters: AllTeachersFilters = {}) {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.allTeachers(filters),
    queryFn: () => fetchAllTeachersProgress(filters),
    staleTime: 30_000,
  });
}

export function useInstitutionDutySummary() {
  return useQuery({
    queryKey: DUTY_CALC_KEYS.institution,
    queryFn: fetchInstitutionDutySummary,
    staleTime: 30_000,
  });
}

/**
 * Convenience helper — call this from any mutation that changes teacher,
 * course, semester, department, exam, or duty state so every derived widget
 * refetches on the next render. Idempotent; safe to call multiple times.
 */
export function useInvalidateDutyCalculation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: DUTY_CALC_ROOT });
}
