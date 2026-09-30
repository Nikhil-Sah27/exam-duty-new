import { useMemo, useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import type { Duty } from "@/modules/duties/types";
import DashboardHero from "@/modules/shared/dashboard/components/DashboardHero";
import DashboardDutySection from "@/modules/shared/dashboard/components/DashboardDutySection";
import {
  normalizeDutiesCompleted,
  normalizeDutiesUpcoming,
} from "@/modules/shared/dashboard/utils/dashboardNormalizers";
import UpcomingDutyModal from "@/modules/invigilator/upcoming-duties/components/UpcomingDutyModal";
import DutyStatsHeroInline from "@/modules/duty-calculation/components/DutyStatsHeroInline";
import RoleImportantNotificationProvider from "@/modules/dashboard/important-notifications/RoleImportantNotificationProvider";

/**
 * Invigilator dashboard. Same layout contract as RS/DCS dashboards —
 * hero band, upcoming, completed — coloured emerald to match the
 * Invigilator role pill. The hero's right slot renders the live
 * Completed / Remaining / Assigned duty circles.
 *
 * Clicking a duty card opens the shared per-duty modal — the same one used on
 * the Upcoming Duties page — showing that duty's full details.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const dutiesQuery = useDutiesByTeacher(user?.id);
  const duties = dutiesQuery.data ?? [];
  const [selectedDuty, setSelectedDuty] = useState<Duty | null>(null);

  // Normalized card ids are `duty._id`, so this lookup lets a card click open
  // the full Duty in the detail modal.
  const dutyById = useMemo(
    () => new Map(duties.map((d) => [d._id, d])),
    [duties],
  );
  const openByDutyId = (id: string) => {
    const d = dutyById.get(id);
    if (d) setSelectedDuty(d);
  };

  const upcoming = useMemo(
    () =>
      normalizeDutiesUpcoming({ duties, roleLabel: "Invigilator" }).map(
        (item) => ({ ...item, onClick: () => openByDutyId(item.id) }),
      ),
    // openByDutyId reads from dutyById which is memoized above; safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duties, dutyById],
  );
  const completed = useMemo(
    () =>
      normalizeDutiesCompleted({ duties, roleLabel: "Invigilator" }).map(
        (item) => ({ ...item, onClick: () => openByDutyId(item.id) }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duties, dutyById],
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        badge="Invigilator"
        title={`Welcome${user ? `, ${user.name}` : ""}`}
        subtitle="Your invigilation overview — duties coming up and a record of completed shifts."
        gradient="from-emerald-500 via-teal-500 to-cyan-600"
        rightContent={<DutyStatsHeroInline />}
        primaryAction={{ label: "Select Duty", href: "/invigilator/select-duty" }}
        secondaryAction={{
          label: "Upcoming Duties",
          href: "/invigilator/upcoming-duties",
        }}
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
            emptyTitle="No upcoming duties"
            emptyHint="Visit Select Duty to pick from open slots."
            limit={6}
            viewAllHref="/invigilator/upcoming-duties"
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

      <UpcomingDutyModal
        open={Boolean(selectedDuty)}
        duty={selectedDuty}
        onClose={() => setSelectedDuty(null)}
      />

      <RoleImportantNotificationProvider />
    </div>
  );
}
