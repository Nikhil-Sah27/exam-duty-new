import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveChangeRequest,
  createChangeRequest,
  deleteChangeRequest,
  getAvailableReplacementDuties,
  getPendingChangeRequests,
  getTeacherChangeRequests,
  rejectChangeRequest,
} from "../services/changeRequestService";
import type {
  ChangeRequestStatus,
  CreateChangeRequestPayload,
} from "../types/changeRequest.types";

const KEYS = {
  all: (status?: ChangeRequestStatus) => ["change-requests", "all", status ?? "all"] as const,
  mine: ["change-requests", "mine"] as const,
  replacements: (dutyId: string) => ["change-requests", "replacements", dutyId] as const,
};

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["change-requests"] });
  // Approval/reject can move teachers between duties, so refresh duty-related caches too.
  qc.invalidateQueries({ queryKey: ["shared", "duty-status"] });
  qc.invalidateQueries({ queryKey: ["shared", "duties-by-teacher"] });
  // DCS group swaps move whole groups between teachers — invalidate the
  // group caches the DCS dashboard, Upcoming Duties, and Select Duty share.
  qc.invalidateQueries({ queryKey: ["dcs"] });
  // Any approved/rejected request changes an invigilator's completed count —
  // refresh the duty-target widget on the next render.
  qc.invalidateQueries({ queryKey: ["duty-calculation"] });
};

export function useAllChangeRequests(status?: ChangeRequestStatus) {
  return useQuery({
    queryKey: KEYS.all(status),
    queryFn: () => getPendingChangeRequests(status),
  });
}

export function useMyChangeRequests() {
  return useQuery({ queryKey: KEYS.mine, queryFn: getTeacherChangeRequests });
}

export function useReplacementDuties(dutyId: string | null) {
  return useQuery({
    queryKey: KEYS.replacements(dutyId as string),
    queryFn: () => getAvailableReplacementDuties(dutyId as string),
    enabled: Boolean(dutyId),
  });
}

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChangeRequestPayload) => createChangeRequest(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useApproveChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveChangeRequest(id, note),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRejectChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      rejectChangeRequest(id, note),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChangeRequest(id),
    // Deleting only removes the request record; no duty state changes, so just
    // refresh the change-request lists/counts.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-requests"] }),
  });
}
