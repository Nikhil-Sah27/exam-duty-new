import api from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";

import type { AdStatus } from "./types";

/** The signed-in teacher's ad level and the reasons for it. */
export async function fetchAdStatus(): Promise<AdStatus> {
  const res = await api.get<ApiEnvelope<AdStatus>>("/ads/status");
  return res.data.data ?? { level: 0, reasons: [] };
}
