import { useMemo } from "react";
import { Building2, Calendar, Clock, DoorOpen, X } from "lucide-react";
import type { RSUpcomingGroup } from "../utils/rsUpcomingGrouping";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import {
  formatLongDate,
  formatTime,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";
import InvigilatorContactsSection from "@/modules/shared/duties/components/InvigilatorContactsSection";

interface RSUpcomingGroupModalProps {
  open: boolean;
  group: RSUpcomingGroup | null;
  onClose: () => void;
}

/**
 * Details view for one RS group — shows the full room roster in the group
 * with per-room floor + capacity so the RS knows exactly what they're
 * supervising. Kept intentionally read-only; changes go through
 * Change Requests.
 */
export default function RSUpcomingGroupModal({
  open,
  group,
  onClose,
}: RSUpcomingGroupModalProps) {
  // Collect ExamRoom ids for this group up-front so the invigilator lookup
  // runs against a stable list (and the react-query key stays stable across
  // re-renders while the modal is open).
  const examRoomIds = useMemo(
    () =>
      (group?.rooms ?? [])
        .map((r) => r.duty.examRoom?._id)
        .filter((id): id is string => Boolean(id)),
    [group],
  );

  if (!open || !group) return null;

  const typeColor = getTypeColor(group.examType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
              >
                {group.examType}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                Sem {group.semester}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                <Building2 className="h-2.5 w-2.5" /> RS · Group
              </span>
            </div>
            <h3 className="truncate text-base font-semibold text-gray-800">
              {group.buildingName} — {group.rangeLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaLine
              icon={<Calendar className="h-4 w-4" />}
              label="Date"
              value={formatLongDate(group.date)}
            />
            <MetaLine
              icon={<Clock className="h-4 w-4" />}
              label="Time"
              value={`${formatTime(group.startTime)} – ${formatTime(group.endTime)}`}
            />
            <MetaLine
              icon={<Building2 className="h-4 w-4" />}
              label="Block"
              value={group.buildingName}
            />
            <MetaLine
              icon={<DoorOpen className="h-4 w-4" />}
              label="Rooms"
              value={`${group.rooms.length} in this group`}
            />
          </div>

          {group.departments.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Departments
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {group.departments.join(", ")}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Rooms in this Group
            </p>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {group.rooms.map((r) => (
                <li
                  key={r.dutyId}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-gray-800">
                    {group.buildingName} — {r.roomNumber}
                  </span>
                  <span className="text-xs text-gray-500">
                    {r.floor !== undefined && `Floor ${r.floor}`}
                    {r.floor !== undefined && r.capacity !== undefined && " · "}
                    {r.capacity !== undefined && `Cap ${r.capacity}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Instructions
            </p>
            <p className="mt-1 text-xs text-gray-600">
              As Room Superintendent, you supervise every room in this group.
              Arrive 15 minutes before the start time and coordinate with the
              invigilators assigned to each room.
            </p>
          </div>

          <InvigilatorContactsSection
            examRoomIds={examRoomIds}
            title="Invigilator Contacts"
            subtitle="People currently assigned to each room under your supervision."
          />
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  );
}
