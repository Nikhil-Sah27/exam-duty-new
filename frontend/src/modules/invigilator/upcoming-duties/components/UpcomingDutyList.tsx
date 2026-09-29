import type { Duty } from "@/modules/duties/types";
import type { DateGroup } from "@/modules/shared/duties/utils/upcomingDutyUtils";
import UpcomingDutyGroup from "./UpcomingDutyGroup";

interface UpcomingDutyListProps {
  groups: DateGroup[];
  onDutyClick: (duty: Duty) => void;
}

export default function UpcomingDutyList({
  groups,
  onDutyClick,
}: UpcomingDutyListProps) {
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <UpcomingDutyGroup key={g.dateKey} group={g} onDutyClick={onDutyClick} />
      ))}
    </div>
  );
}
