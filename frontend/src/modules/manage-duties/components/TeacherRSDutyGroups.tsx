import { useMemo, useState } from "react";
import type { Duty } from "@/modules/duties/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import {
  groupRSDutiesIntoUpcomingGroups,
  type RSUpcomingGroup,
} from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";
import RSUpcomingGroupCard from "@/modules/rs/upcoming-duties/components/RSUpcomingGroupCard";
import RSUpcomingGroupModal from "@/modules/rs/upcoming-duties/components/RSUpcomingGroupModal";
import DutyGroupSection from "./DutyGroupSection";

interface TeacherRSDutyGroupsProps {
  duties: Duty[];
}

/**
 * RS duties on the CS Manage Duties detail page, shown as the same room-groups
 * the RS sees on their own dashboard rather than one row per room. Reuses the
 * exact grouping util and group card/modal from the RS module so the grouping
 * is guaranteed identical — the CS view is read-only (changes go through the
 * assign/change-request flows).
 *
 * The upcoming/completed split follows the shared `isDutyUpcoming` rule (the
 * single source of truth for that split), grouping each half independently.
 */
export default function TeacherRSDutyGroups({
  duties,
}: TeacherRSDutyGroupsProps) {
  const [active, setActive] = useState<RSUpcomingGroup | null>(null);

  const { upcomingGroups, completedGroups } = useMemo(() => {
    const live = duties.filter((d) => d.status !== "cancelled");
    const upcoming = live.filter(
      (d) => d.status === "assigned" && isDutyUpcoming(d.date, d.endTime),
    );
    const completed = live.filter(
      (d) => !(d.status === "assigned" && isDutyUpcoming(d.date, d.endTime)),
    );
    return {
      upcomingGroups: groupRSDutiesIntoUpcomingGroups(upcoming),
      completedGroups: groupRSDutiesIntoUpcomingGroups(completed),
    };
  }, [duties]);

  return (
    <>
      <DutyGroupSection
        title="Upcoming Duties"
        variant="upcoming"
        count={upcomingGroups.length}
        emptyLabel="No upcoming RS groups"
      >
        <GroupGrid groups={upcomingGroups} onGroupClick={setActive} />
      </DutyGroupSection>

      <DutyGroupSection
        title="Completed Duties"
        variant="completed"
        count={completedGroups.length}
        emptyLabel="No completed RS groups"
      >
        <GroupGrid groups={completedGroups} onGroupClick={setActive} />
      </DutyGroupSection>

      <RSUpcomingGroupModal
        open={!!active}
        group={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function GroupGrid({
  groups,
  onGroupClick,
}: {
  groups: RSUpcomingGroup[];
  onGroupClick: (group: RSUpcomingGroup) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <RSUpcomingGroupCard
          key={group.groupId}
          group={group}
          onClick={onGroupClick}
        />
      ))}
    </div>
  );
}
