import api from "@/shared/lib/api";
import type { ChangeRequest } from "@/modules/shared/change-requests/types/changeRequest.types";

interface ApiSingle<T> {
  success: boolean;
  data: T;
}

/**
 * DCS group swap submission. Reuses the existing `POST /change-requests`
 * endpoint by sending `type: "dcs_swap"` plus the source/target group IDs.
 * The backend service routes this to the DCS scope handler and persists a
 * ChangeRequest with `scope: "dcs_group"`.
 *
 * Approval and rejection use the standard endpoints
 * (`PATCH /change-requests/:id/approve|reject`) — there is no DCS-specific
 * review API. The CS dashboard and review UI work unchanged.
 */
export interface SubmitDcsSwapPayload {
  dcsSourceGroup: string;
  dcsTargetGroup: string;
  reason: string;
}

export const submitDcsGroupSwap = async (
  payload: SubmitDcsSwapPayload
): Promise<ChangeRequest> => {
  const res = await api.post<ApiSingle<ChangeRequest>>("/change-requests", {
    type: "dcs_swap",
    dcsSourceGroup: payload.dcsSourceGroup,
    dcsTargetGroup: payload.dcsTargetGroup,
    reason: payload.reason,
  });
  return res.data.data;
};
