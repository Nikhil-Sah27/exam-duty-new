import { Clock } from "lucide-react";
import type { Duty } from "@/modules/duties/types";
import type { DateGroup } from "@/modules/shared/duties/utils/upcomingDutyUtils";
import { formatLongDate, formatTime } from "@/modules/shared/duties/utils/upcomingDutyUtils";
import UpcomingDutyCard from "./UpcomingDutyCard";

interface UpcomingDutyGroupProps {
  group: DateGroup;
  onDutyClick: (duty: Duty) => void;
}

export default function UpcomingDutyGroup({
  group,
  onDutyClick,
}: UpcomingDutyGroupProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {formatLongDate(group.date)}
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="space-y-4">
        {group.timeSlots.map((slot) => (
          <div key={`${slot.startTime}-${slot.endTime}`}>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Clock className="h-4 w-4 text-blue-500" />
              {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
              <span className="ml-2 text-[11px] font-normal text-gray-400">
                {slot.duties.length} dut{slot.duties.length === 1 ? "y" : "ies"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {slot.duties.map((duty) => (
                <UpcomingDutyCard
                  key={duty._id}
                  duty={duty}
                  onClick={onDutyClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
