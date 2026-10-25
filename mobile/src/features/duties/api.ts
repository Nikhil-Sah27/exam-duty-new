import api from "@/lib/api";
import type { ApiEnvelope, DutyUnit } from "@/lib/types";

/** The caller's live upcoming duty units across all of their roles, soonest first. */
export async function fetchMyUnits(): Promise<DutyUnit[]> {
  const res = await api.get<ApiEnvelope<DutyUnit[]>>("/duties/my-units");
  return res.data.data ?? [];
}

/** One completed duty unit — mirrors listCompletedDutyUnits (backend duty-calculation). */
export interface CompletedDuty {
  key: string;
  role: "invigilator" | "rs" | "dcs";
  date: string;
  startTime: string;
  endTime: string;
  examType: string | null;
  semester: number | null;
  rooms: { roomNumber: string; building: string | null }[];
}

/**
 * The caller's completed duties for their active role, newest first — exactly
 * the units the progress "Completed" number counts (same backend function).
 */
export async function fetchMyCompleted(): Promise<CompletedDuty[]> {
  const res = await api.get<ApiEnvelope<CompletedDuty[]>>("/duty-calculation/my-completed");
  return res.data.data ?? [];
}

/** Confirms the whole unit (every room of an RS/DCS group). */
export async function confirmDuty(primaryDutyId: string): Promise<void> {
  await api.post(`/duties/${primaryDutyId}/confirm`);
}
