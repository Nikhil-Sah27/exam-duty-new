import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "../services/auditService";
import type { AuditFilters } from "../types";

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => fetchAuditLogs(filters),
    placeholderData: (prev) => prev, // keep the table steady while paging
  });
}
