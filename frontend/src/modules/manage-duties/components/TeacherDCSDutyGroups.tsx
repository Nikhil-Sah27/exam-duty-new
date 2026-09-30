import { useMemo, useState } from "react";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import DcsDutyCard from "@/modules/dcs/upcoming-duties/components/DcsDutyCard";
import DcsDutyModal from "@/modules/dcs/upcoming-duties/components/DcsDutyModal";
import DutyGroupSection from "./DutyGroupSection";
import UnassignLink from "./UnassignLink";

interface TeacherDCSDutyGroupsProps {
  groups: DcsGroup[];
  /** CS only — offers Unassign on each upcoming group. */
  onUnassign?: (group: DcsGroup) => void;
}

/**
 * DCS duties on the CS Manage Duties detail page. DCS groups are persisted
 * server-side, so we render the same DcsGroup documents (via the same card +
 * modal) the DCS sees on their own Upcoming Duties page instead of the flat
 * per-room duty rows. Groups have no "completed" status of their own, so the
 * upcoming/completed split is purely time-based via the shared `isDutyUpcoming`.
 */
export default function TeacherDCSDutyGroups({
  groups,
  onUnassign,
}: TeacherDCSDutyGroupsProps) {
  const [active, setActive] = useState<DcsGroup | null>(null);

  const { upcoming, completed } = useMemo(() => {
    const claimed = groups.filter((g) => g.status === "claimed");
    return {
      upcoming: claimed.filter((g) =>
        isDutyUpcoming(g.schedule.date, g.schedule.endTime),
      ),
      completed: claimed.filter(
        (g) => !isDutyUpcoming(g.schedule.date, g.schedule.endTime),
      ),
    };
  }, [groups]);

  return (
    <>
      <DutyGroupSection
        title="Upcoming Duties"
        variant="upcoming"
        count={upcoming.length}
        emptyLabel="No upcoming DCS groups"
      >
        <GroupGrid groups={upcoming} onGroupClick={setActive} onUnassign={onUnassign} />
      </DutyGroupSection>

      <DutyGroupSection
        title="Completed Duties"
        variant="completed"
        count={completed.length}
        emptyLabel="No completed DCS groups"
      >
        <GroupGrid groups={completed} onGroupClick={setActive} />
      </DutyGroupSection>

      <DcsDutyModal
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
  onUnassign,
}: {
  groups: DcsGroup[];
  onGroupClick: (group: DcsGroup) => void;
  onUnassign?: (group: DcsGroup) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group._id} className="space-y-1.5">
          <DcsDutyCard group={group} onClick={onGroupClick} />
          {onUnassign && <UnassignLink onClick={() => onUnassign(group)} />}
        </div>
      ))}
    </div>
  );
}
