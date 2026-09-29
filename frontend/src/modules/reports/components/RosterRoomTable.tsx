import type { DutyStatusMap, ExamSchedule } from "@/modules/exams/types";
import {
  DEPARTMENT_CHIP_CLASS,
  ROLES,
  roomLabel,
  sortRooms,
} from "../utils/rosterFormat";
import AssigneeCell from "./AssigneeCell";

/**
 * The room-by-room table for a single shift: one row per room with its
 * department and the three role assignments. Horizontally scrollable so it
 * never forces the page to scroll sideways on narrow screens.
 */
export default function RosterRoomTable({
  schedule,
  statusMap,
}: {
  schedule: ExamSchedule;
  statusMap: DutyStatusMap;
}) {
  const rooms = sortRooms(schedule.rooms);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50/60 text-xs uppercase tracking-widest text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Room</th>
            {ROLES.map((r) => (
              <th key={r.key} className="px-4 py-2 text-left">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rooms.map((room) => {
            const flags = statusMap[room._id];
            return (
              <tr key={room._id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-2 font-semibold text-gray-800">
                  <div>{roomLabel(room)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {room.departments?.length ? (
                      room.departments.map((d) => (
                        <span key={d} className={DEPARTMENT_CHIP_CLASS}>
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] font-normal text-gray-400">
                        —
                      </span>
                    )}
                  </div>
                </td>
                {ROLES.map((r) => (
                  <AssigneeCell key={r.key} assignee={flags?.[r.key] ?? null} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
