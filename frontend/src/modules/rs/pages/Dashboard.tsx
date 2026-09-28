import { useMemo, useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import DashboardHero from "@/modules/shared/dashboard/components/DashboardHero";
import DashboardDutySection from "@/modules/shared/dashboard/components/DashboardDutySection";
import {
  normalizeRsGroupsCompleted,
  normalizeRsGroupsUpcoming,
} from "@/modules/shared/dashboard/utils/dashboardNormalizers";
import {
  groupRSDutiesIntoUpcomingGroups,
  type RSUpcomingGroup,
} from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";
import RSUpcomingGroupModal from "@/modules/rs/upcoming-duties/components/RSUpcomingGroupModal";
import RsDutyStatsHeroInline from "@/modules/duty-calculation/components/RsDutyStatsHeroInline";
import RoleImportantNotificationProvider from "@/modules/dashboard/important-notifications/RoleImportantNotificationProvider";

/**
 * RS dashboard. Same layout contract as the DCS / Invigilator dashboards —
 * hero band + upcoming + completed sections — but coloured for the RS
 * (Room Superintendent) role. RS is a *group* role: cards represent whole
 * room groups (up to 5 rooms per schedule + building), never individual rooms.
 *
 * Clicking a card opens the shared RS group modal — same one used on the
 * Upcoming Duties page — which now includes per-room invigilator contacts.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const dutiesQuery = useDutiesByTeacher(user?.id);
  const duties = dutiesQuery.data ?? [];
  const [selectedGroup, setSelectedGroup] = useState<RSUpcomingGroup | null>(
    null,
  );

  // Build the full groupId → RSUpcomingGroup lookup once. Both the upcoming
  // and completed normalizers derive their group ids from the same grouping
  // util applied to non-cancelled duties, so the ids align.
  const groupById = useMemo(() => {
    const active = duties.filter((d) => d.status !== "cancelled");
    const all = groupRSDutiesIntoUpcomingGroups(active);
    return new Map(all.map((g) => [g.groupId, g]));
  }, [duties]);

  const openByGroupId = (groupId: string) => {
    const g = groupById.get(groupId);
    if (g) setSelectedGroup(g);
  };

  const upcoming = useMemo(
    () =>
      normalizeRsGroupsUpcoming({ duties }).map((item) => ({
        ...item,
        onClick: () => openByGroupId(item.id),
      })),
    // openByGroupId reads from groupById which is memoized above; safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duties, groupById],
  );
  const completed = useMemo(
    () =>
      normalizeRsGroupsCompleted({ duties }).map((item) => ({
        ...item,
        onClick: () => openByGroupId(item.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duties, groupById],
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        badge="Room Superintendent"
        title={`Welcome${user ? `, ${user.name}` : ""}`}
        subtitle="Your room-batch overview — supervision groups you're holding and a log of completed shifts."
        gradient="from-amber-500 via-orange-500 to-rose-500"
        rightContent={<RsDutyStatsHeroInline />}
        primaryAction={{ label: "Select Duty", href: "/rs/select-duty" }}
        secondaryAction={{ label: "Upcoming Duties", href: "/rs/upcoming-duties" }}
      />

      {dutiesQuery.isLoading && (
        <p className="text-sm text-gray-500">Loading your duties...</p>
      )}
      {dutiesQuery.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load your duties. Please try again later.
        </div>
      )}

      {!dutiesQuery.isLoading && !dutiesQuery.error && (
        <>
          <DashboardDutySection
            title="Upcoming Duties"
            tone="upcoming"
            items={upcoming}
            emptyTitle="No upcoming RS duties"
            emptyHint="Pick a room batch from Select Duty to staff one."
            limit={6}
            viewAllHref="/rs/upcoming-duties"
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

      <RSUpcomingGroupModal
        open={Boolean(selectedGroup)}
        group={selectedGroup}
        onClose={() => setSelectedGroup(null)}
      />

      <RoleImportantNotificationProvider />
    </div>
  );
}
