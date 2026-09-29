import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import DashboardHero from "@/modules/shared/dashboard/components/DashboardHero";
import DashboardDutySection from "@/modules/shared/dashboard/components/DashboardDutySection";
import {
  normalizeDcsCompleted,
  normalizeDcsUpcoming,
} from "../upcoming-duties/utils/dcsDashboardNormalizers";
import { getMyDcsGroups } from "../select-duty/services/dcsDutyService";
import type { DcsGroup } from "../select-duty/types";
import DcsDutyModal from "../upcoming-duties/components/DcsDutyModal";
import DcsDutyStatsHeroInline from "@/modules/duty-calculation/components/DcsDutyStatsHeroInline";
import RoleImportantNotificationProvider from "@/modules/dashboard/important-notifications/RoleImportantNotificationProvider";

/**
 * DCS dashboard. Mirrors the structure used by the RS and Invigilator
 * dashboards — same hero band + upcoming + completed sections, fed by the
 * DCS-specific data source.
 *
 * Clicking any duty card opens the shared DcsDutyModal, which fetches per-room
 * invigilator contact details so a DCS can see (and reach) the invigilators
 * working under them.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [selectedGroup, setSelectedGroup] = useState<DcsGroup | null>(null);

  const myGroupsQuery = useQuery({
    queryKey: ["dcs", "my-groups"],
    queryFn: getMyDcsGroups,
    staleTime: 30_000,
  });
  const groups = myGroupsQuery.data ?? [];

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g._id, g])),
    [groups],
  );

  const openByGroupId = (id: string) => {
    const g = groupById.get(id);
    if (g) setSelectedGroup(g);
  };

  const upcoming = useMemo(
    () =>
      normalizeDcsUpcoming({ groups }).map((item) => ({
        ...item,
        onClick: () => openByGroupId(item.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, groupById],
  );
  const completed = useMemo(
    () =>
      normalizeDcsCompleted({ groups }).map((item) => ({
        ...item,
        onClick: () => openByGroupId(item.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, groupById],
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        badge="Deputy Chief Superintendent"
        title={`Welcome${user ? `, ${user.name}` : ""}`}
        subtitle="Your supervision overview — upcoming groups, classes under your watch, and a record of completed duties."
        gradient="from-blue-600 via-indigo-600 to-violet-600"
        rightContent={<DcsDutyStatsHeroInline />}
        primaryAction={{ label: "Select Duty", href: "/dcs/select-duty" }}
        secondaryAction={{ label: "Upcoming Duties", href: "/dcs/upcoming-duties" }}
      />

      {myGroupsQuery.isLoading && (
        <p className="text-sm text-gray-500">Loading your duties...</p>
      )}
      {myGroupsQuery.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load your duties. Please try again later.
        </div>
      )}

      {!myGroupsQuery.isLoading && !myGroupsQuery.error && (
        <>
          <DashboardDutySection
            title="Upcoming Duties"
            tone="upcoming"
            items={upcoming}
            emptyTitle="No upcoming DCS duties"
            emptyHint="Pick a supervision group from Select Duty to staff one."
            limit={6}
            viewAllHref="/dcs/upcoming-duties"
          />

          <DashboardDutySection
            title="Completed Duties"
            tone="completed"
            items={completed}
            emptyTitle="No completed duties yet"
            emptyHint="Duties move here automatically once their end time passes."
            limit={6}
          />
        </>
      )}

      <DcsDutyModal
        open={Boolean(selectedGroup)}
        group={selectedGroup}
        onClose={() => setSelectedGroup(null)}
      />

      <RoleImportantNotificationProvider />
    </div>
  );
}
