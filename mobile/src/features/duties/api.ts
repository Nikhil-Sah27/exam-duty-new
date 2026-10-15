import api from "@/lib/api";
import type { ApiEnvelope, DutyUnit } from "@/lib/types";

/** The caller's live upcoming duty units across all of their roles, soonest first. */
export async function fetchMyUnits(): Promise<DutyUnit[]> {
  const res = await api.get<ApiEnvelope<DutyUnit[]>>("/duties/my-units");
  return res.data.data ?? [];
}

/** Confirms the whole unit (every room of an RS/DCS group). */
export async function confirmDuty(primaryDutyId: string): Promise<void> {
  await api.post(`/duties/${primaryDutyId}/confirm`);
}
