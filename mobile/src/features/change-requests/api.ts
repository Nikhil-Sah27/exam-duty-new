import api from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";

import type { ChangeRequest, CreateChangeRequestPayload, ReplacementSlot } from "./types";

// Same endpoints and bodies as the web:
//   frontend/src/modules/shared/change-requests/services/changeRequestService.ts
//   frontend/src/modules/dcs/change-requests/services/dcsChangeRequestService.ts
//   frontend/src/modules/dcs/select-duty/services/dcsDutyService.ts
// Teachers read only their own requests (GET /change-requests/mine) — the full
// list is CS's review queue and is CS-only on the backend, as are approve/reject.

/** Requests the signed-in teacher submitted, newest first. */
export async function fetchMyChangeRequests(): Promise<ChangeRequest[]> {
  const res = await api.get<ApiEnvelope<ChangeRequest[]>>("/change-requests/mine");
  return res.data.data ?? [];
}

/** Vacant invigilator slots the given duty could move to (server filters conflicts). */
export async function fetchReplacementSlots(dutyId: string): Promise<ReplacementSlot[]> {
  const res = await api.get<ApiEnvelope<ReplacementSlot[]>>(`/change-requests/replacements/${dutyId}`);
  return res.data.data ?? [];
}

export async function createChangeRequest(payload: CreateChangeRequestPayload): Promise<ChangeRequest> {
  const res = await api.post<ApiEnvelope<ChangeRequest>>("/change-requests", payload);
  return res.data.data;
}

/** The viewer's claimed DCS groups. */
export async function fetchMyDcsGroups(): Promise<DcsGroup[]> {
  const res = await api.get<ApiEnvelope<DcsGroup[]>>("/dcs/groups/mine");
  return res.data.data ?? [];
}

/** Open DCS groups — the swap-target pool. */
export async function fetchOpenDcsGroups(): Promise<DcsGroup[]> {
  const res = await api.get<ApiEnvelope<DcsGroup[]>>("/dcs/groups", { params: { status: "open" } });
  return res.data.data ?? [];
}

// ── CS review (requireRole("cs") on the server) ─────────────────────────────

/** CS's review queue, filtered by status, newest first. */
export async function fetchAllChangeRequests(status?: "pending" | "approved" | "rejected"): Promise<ChangeRequest[]> {
  const res = await api.get<ApiEnvelope<ChangeRequest[]>>("/change-requests", { params: status ? { status } : undefined });
  return res.data.data ?? [];
}

/** Approve or reject with an optional note to the requester. */
export async function reviewChangeRequest(id: string, action: "approve" | "reject", note?: string): Promise<ChangeRequest> {
  const res = await api.patch<ApiEnvelope<ChangeRequest>>(`/change-requests/${id}/${action}`, { note: note || undefined });
  return res.data.data;
}
