import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyDcsGroups } from "../../select-duty/services/dcsDutyService";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type { DcsGroup } from "../../select-duty/types";

export interface DcsUpcomingEntry {
  group: DcsGroup;
}

export interface DcsUpcomingDateGroup {
  dateKey: string; // YYYY-MM-DD
  date: string;
  entries: DcsUpcomingEntry[];
}

/**
 * "Upcoming" filter: claimed groups whose end time hasn't passed yet (a group
 * that finished earlier today drops off). Sorted by date then start time so the
 * earliest duty surfaces first.
 */
function filterAndSort(groups: DcsGroup[]): DcsGroup[] {
  return groups
    .filter((g) => g.status === "claimed")
    .filter((g) => isDutyUpcoming(g.schedule.date, g.schedule.endTime))
    .sort((a, b) => {
      const da = new Date(a.schedule.date).getTime();
      const db = new Date(b.schedule.date).getTime();
      if (da !== db) return da - db;
      return a.schedule.startTime.localeCompare(b.schedule.startTime);
    });
}

function groupByDate(groups: DcsGroup[]): DcsUpcomingDateGroup[] {
  const byDate = new Map<string, DcsGroup[]>();
  for (const g of groups) {
    const key = new Date(g.schedule.date).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(g);
    else byDate.set(key, [g]);
  }
  return [...byDate.entries()].map(([dateKey, list]) => ({
    dateKey,
    date: list[0].schedule.date,
    entries: list.map((g) => ({ group: g })),
  }));
}

export function useDcsUpcomingDuties() {
  const query = useQuery({
    queryKey: ["dcs", "my-groups"],
    queryFn: getMyDcsGroups,
    staleTime: 30_000,
  });

  const upcoming = useMemo(
    () => filterAndSort(query.data ?? []),
    [query.data],
  );
  const groups = useMemo(() => groupByDate(upcoming), [upcoming]);

  return {
    duties: upcoming,
    groups,
    isLoading: query.isLoading,
    error: query.error,
  };
}
