import { Clock } from "lucide-react";
import type {
  RSUpcomingDateGroup,
  RSUpcomingGroup,
} from "../utils/rsUpcomingGrouping";
import {
  formatLongDate,
  formatTime,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";
import RSUpcomingGroupCard from "./RSUpcomingGroupCard";

interface RSUpcomingGroupListProps {
  dateGroups: RSUpcomingDateGroup[];
  onGroupClick: (group: RSUpcomingGroup) => void;
}

/**
 * Outer layout: date section → time-slot subsection → grid of group cards.
 * Mirrors the invigilator UpcomingDutyList structure so the two roles feel
 * consistent, but the leaf tiles show groups instead of individual duties.
 */
export default function RSUpcomingGroupList({
  dateGroups,
  onGroupClick,
}: RSUpcomingGroupListProps) {
  return (
    <div className="space-y-8">
      {dateGroups.map((day) => (
        <section key={day.dateKey}>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {formatLongDate(day.date)}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-4">
            {day.timeSlots.map((slot) => (
              <div key={`${slot.startTime}-${slot.endTime}`}>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  <span className="ml-2 text-[11px] font-normal text-gray-400">
                    {slot.groups.length} group{slot.groups.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {slot.groups.map((group) => (
                    <RSUpcomingGroupCard
                      key={group.groupId}
                      group={group}
                      onClick={onGroupClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
