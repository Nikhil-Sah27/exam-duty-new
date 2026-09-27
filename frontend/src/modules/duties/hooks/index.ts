
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDuties,
  selfAssignDuty,
  adminAssignDuty,
  cancelDuty,
} from "../services";
import { SelfAssignRequest, AdminAssignRequest } from "../types";
import { getBusyTeacherIds } from "../utils/dutyConflictUtils";
import type { TimeWindow } from "@/modules/shared/duties/utils/timeConflictUtils";

const DUTIES_KEY = ["duties"];

export const useDuties = () => {
  return useQuery({
    queryKey: DUTIES_KEY,
    queryFn: fetchDuties,
  });
};

/**
 * Set of teacher ids already holding an assigned duty that overlaps `window`.
 * Backed by the shared duties list so it mirrors the backend conflict scan.
 * Returns an empty set when no window is supplied (or duties haven't loaded).
 */
export const useBusyTeacherIds = (window?: TimeWindow): Set<string> => {
  const { data: duties } = useDuties();
  return useMemo(() => {
    if (!window || !duties) return new Set<string>();
    return getBusyTeacherIds(duties, window);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duties, window?.date, window?.startTime, window?.endTime]);
};

export const useSelfAssignDuty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SelfAssignRequest) => selfAssignDuty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DUTIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

export const useAdminAssignDuty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminAssignRequest) => adminAssignDuty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DUTIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

export const useCancelDuty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelDuty(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DUTIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};
