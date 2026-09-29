import api from "@/shared/lib/api";
import type { AuditFilters, AuditListResponse } from "../types";

export const fetchAuditLogs = async (
  filters: AuditFilters = {}
): Promise<AuditListResponse> => {
  const res = await api.get<AuditListResponse>("/audit", { params: filters });
  return res.data;
};
