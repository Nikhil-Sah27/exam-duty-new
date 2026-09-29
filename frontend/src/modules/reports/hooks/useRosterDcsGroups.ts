import { useQuery } from "@tanstack/react-query";
import { getDcsDutyGroups } from "@/modules/duties/services/dcsGroupingService";

export const rosterDcsGroupsKey = (examGroupId: string) => [
  "reports",
  "dcs-groups",
  examGroupId,
];

/**
 * DCS duty groups for one exam group, used by the roster's DCS coverage tile.
 * DCS groups are persisted (sized at exam finalize), so we read them from the
 * backend through the shared DCS grouping service rather than deriving groups
 * client-side — the same source every other DCS surface uses.
 */
export const useRosterDcsGroups = (examGroupId: string) =>
  useQuery({
    queryKey: rosterDcsGroupsKey(examGroupId),
    queryFn: () => getDcsDutyGroups({ examGroup: examGroupId }),
    enabled: !!examGroupId,
  });
