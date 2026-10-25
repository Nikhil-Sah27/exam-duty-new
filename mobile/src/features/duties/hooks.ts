import { useMutation, useQuery } from "@tanstack/react-query";

import { syncAlarms } from "@/alarms";
import { confirmDuty, fetchMyCompleted, fetchMyUnits } from "@/features/duties/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { DutyUnit } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

export function useMyUnits() {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: queryKeys.myUnits, queryFn: fetchMyUnits, enabled: !!token });
}

/** Completed duties for the active role (the list behind Home → Completed). */
export function useMyCompletedDuties() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  return useQuery({
    queryKey: queryKeys.myCompleted(role),
    queryFn: fetchMyCompleted,
    enabled: !!token && !!role,
  });
}

export function useConfirmUnit() {
  return useMutation({
    mutationFn: (unit: DutyUnit) => confirmDuty(unit.primaryDutyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myUnits });
      void syncAlarms();
    },
  });
}

/** Look a unit up in the cached list (detail + alarm screens). */
export function useUnit(key: string | undefined) {
  const query = useMyUnits();
  const unit = key ? query.data?.find((u) => u.key === key) : undefined;
  return { ...query, unit };
}
