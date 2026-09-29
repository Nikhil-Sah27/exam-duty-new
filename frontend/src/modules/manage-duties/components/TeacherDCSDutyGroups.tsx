import { useMemo, useState } from "react";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import DcsDutyCard from "@/modules/dcs/upcoming-duties/components/DcsDutyCard";
import DcsDutyModal from "@/modules/dcs/upcoming-duties/components/DcsDutyModal";
import DutyGroupSection from "./DutyGroupSection";

interface TeacherDCSDutyGroupsProps {
  groups: DcsGroup[];
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
        <GroupGrid groups={upcoming} onGroupClick={setActive} />
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
}: {
  groups: DcsGroup[];
  onGroupClick: (group: DcsGroup) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <DcsDutyCard key={group._id} group={group} onClick={onGroupClick} />
      ))}
    </div>
  );
}
