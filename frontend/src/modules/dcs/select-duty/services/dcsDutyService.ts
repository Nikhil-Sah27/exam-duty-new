import api from "@/shared/lib/api";
import type { DcsGroup, DcsRoomContactsResponse } from "../types";

interface ListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Read all DCS groups visible to the current user. The backend filters by
 * `status` query string when supplied — e.g. `status=open` to drop the
 * already-claimed ones. We keep them by default so the UI can render
 * "Occupied by …" cards and explain why they aren't selectable.
 */
export const listDcsGroups = async (params?: {
  examGroup?: string;
  schedule?: string;
  status?: "open" | "claimed" | "released";
  /** Filter to groups claimed by a specific teacher (CS Manage Duties view). */
  assignedTeacher?: string;
}): Promise<DcsGroup[]> => {
  const res = await api.get<ListResponse<DcsGroup>>("/dcs/groups", { params });
  return res.data.data;
};

export const getMyDcsGroups = async (): Promise<DcsGroup[]> => {
  const res = await api.get<ListResponse<DcsGroup>>("/dcs/groups/mine");
  return res.data.data;
};

export const claimDcsGroup = async (id: string): Promise<DcsGroup> => {
  const res = await api.post<SingleResponse<DcsGroup>>(`/dcs/groups/${id}/claim`);
  return res.data.data;
};

/**
 * CS admin-assigns an entire DCS group to a specific teacher. Reuses the same
 * transactional claim path as self-claim on the backend (one Duty per room +
 * group marked `claimed`), but the assignee is the target teacher and each
 * created duty fires a `duty_assigned` notification. Used by the CS Exams
 * room-detail assignment flow — the group grouping/sizing is untouched.
 */
export const adminClaimDcsGroup = async (
  id: string,
  teacher: string,
): Promise<DcsGroup> => {
  const res = await api.post<SingleResponse<DcsGroup>>(
    `/dcs/groups/${id}/admin-claim`,
    { teacher },
  );
  return res.data.data;
};

export const releaseDcsGroup = async (
  id: string,
  reason?: string,
): Promise<DcsGroup> => {
  const res = await api.post<SingleResponse<DcsGroup>>(
    `/dcs/groups/${id}/release`,
    { reason },
  );
  return res.data.data;
};

export const getDcsGroupContacts = async (
  id: string,
): Promise<DcsRoomContactsResponse> => {
  const res = await api.get<SingleResponse<DcsRoomContactsResponse>>(
    `/dcs/groups/${id}/invigilators`,
  );
  return res.data.data;
};
