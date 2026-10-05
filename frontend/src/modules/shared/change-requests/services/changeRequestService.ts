import api from "@/shared/lib/api";
import type {
  ChangeRequest,
  CreateChangeRequestPayload,
  ReplacementSlot,
} from "../types/changeRequest.types";

interface ApiList<T> {
  success: boolean;
  count?: number;
  data: T[];
}
interface ApiSingle<T> {
  success: boolean;
  data: T;
}

/**
 * Single source of truth for change-request reads + writes. Both Controller
 * (review) and Invigilator (submit + cancel) dashboards consume this.
 */

export const createChangeRequest = async (
  payload: CreateChangeRequestPayload
): Promise<ChangeRequest> => {
  const res = await api.post<ApiSingle<ChangeRequest>>("/change-requests", payload);
  return res.data.data;
};

export const approveChangeRequest = async (
  id: string,
  note?: string
): Promise<ChangeRequest> => {
  const res = await api.patch<ApiSingle<ChangeRequest>>(
    `/change-requests/${id}/approve`,
    { note }
  );
  return res.data.data;
};

export const rejectChangeRequest = async (
  id: string,
  note?: string
): Promise<ChangeRequest> => {
  const res = await api.patch<ApiSingle<ChangeRequest>>(
    `/change-requests/${id}/reject`,
    { note }
  );
  return res.data.data;
};

/** Delete a change-request record (CS-only, audit-logged on the backend). */
export const deleteChangeRequest = async (id: string): Promise<void> => {
  await api.delete(`/change-requests/${id}`);
};

/** All requests across the system — Controller review surface. */
export const getPendingChangeRequests = async (
  status?: "pending" | "approved" | "rejected"
): Promise<ChangeRequest[]> => {
  const params = status ? { status } : undefined;
  const res = await api.get<ApiList<ChangeRequest>>("/change-requests", { params });
  return res.data.data;
};

/** Requests submitted by the logged-in user — Invigilator surface. */
export const getTeacherChangeRequests = async (): Promise<ChangeRequest[]> => {
  const res = await api.get<ApiList<ChangeRequest>>("/change-requests/mine");
  return res.data.data;
};

/** Replacement slots eligible for a "move" request against the given duty. */
export const getAvailableReplacementDuties = async (
  dutyId: string
): Promise<ReplacementSlot[]> => {
  const res = await api.get<ApiList<ReplacementSlot>>(
    `/change-requests/replacements/${dutyId}`
  );
  return res.data.data;
};
