import { useMemo, useState, type ReactNode } from "react";
import type { Duty } from "@/modules/duties/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import {
  groupRSDutiesIntoUpcomingGroups,
  type RSUpcomingGroup,
} from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";
import RSUpcomingGroupCard from "@/modules/rs/upcoming-duties/components/RSUpcomingGroupCard";
import RSUpcomingGroupModal from "@/modules/rs/upcoming-duties/components/RSUpcomingGroupModal";
import DutyGroupSection from "./DutyGroupSection";
import UnassignLink from "./UnassignLink";
import AbsentAction, { type AbsenceControls } from "./AbsentAction";
import { formatDate } from "@/shared/lib/utils";

interface TeacherRSDutyGroupsProps {
  duties: Duty[];
  /** CS only — offers Unassign on each upcoming group. */
  onUnassign?: (group: RSUpcomingGroup) => void;
  /** CS only — offers Mark absent / Undo on each completed group. */
  absence?: AbsenceControls;
}

/**
 * RS duties on the CS Manage Duties detail page, shown as the same room-groups
 * the RS sees on their own dashboard rather than one row per room. Reuses the
 * exact grouping util and group card/modal from the RS module so the grouping
 * is guaranteed identical. The only CS action here is unassigning a whole
 * upcoming group; everything else goes through the assign/change-request flows.
 *
 * The upcoming/completed split follows the shared `isDutyUpcoming` rule (the
 * single source of truth for that split), grouping each half independently.
 */
export default function TeacherRSDutyGroups({
  duties,
  onUnassign,
  absence,
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
        <GroupGrid
          groups={upcomingGroups}
          onGroupClick={setActive}
          action={onUnassign && ((g) => <UnassignLink onClick={() => onUnassign(g)} />)}
        />
      </DutyGroupSection>

      <DutyGroupSection
        title="Completed Duties"
        variant="completed"
        count={completedGroups.length}
        emptyLabel="No completed RS groups"
      >
        <GroupGrid
          groups={completedGroups}
          onGroupClick={setActive}
          action={
            absence &&
            ((g) => (
              <AbsentAction
                controls={absence}
                dutyId={g.rooms[0]?.dutyId}
                what={`RS group of ${g.rooms.length} room${g.rooms.length === 1 ? "" : "s"} on ${formatDate(g.date)}`}
              />
            ))
          }
        />
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
  action,
}: {
  groups: RSUpcomingGroup[];
  onGroupClick: (group: RSUpcomingGroup) => void;
  /** A CS action under each card, kept outside it so it never opens the card. */
  action?: (group: RSUpcomingGroup) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.groupId} className="space-y-1.5">
          <RSUpcomingGroupCard group={group} onClick={onGroupClick} />
          {action?.(group)}
        </div>
      ))}
    </div>
  );
}
