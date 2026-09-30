import { Building2, DoorOpen } from "lucide-react";
import type { AssigneePublic } from "@/modules/exams/types";
import {
  groupSummaryRoomsByBuilding,
  type SummaryRoom,
} from "./dutyGroupSummaryUtils";

export function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold text-gray-800">
        {value}
      </p>
    </div>
  );
}

export function RoomsByBuildingPanel({
  rooms,
}: {
  rooms: readonly SummaryRoom[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Rooms in Group
      </p>
      {/* Group by building so users see at a glance "Academic Block:
          103, 401, 403 / Lab Block: 205" rather than a flat list of
          ambiguous room numbers. */}
      <div className="space-y-2">
        {groupSummaryRoomsByBuilding(rooms).map((b) => (
          <div key={b.buildingName} className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              <Building2 className="h-2.5 w-2.5" />
              {b.buildingName}
            </p>
            <div className="flex flex-wrap gap-1">
              {b.rooms.map((r) => (
                <span
                  key={r.examRoomId}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200"
                  title={`${b.buildingName} — Room ${r.roomNumber}${r.floor != null ? ` · Floor ${r.floor}` : ""}`}
                >
                  <DoorOpen className="h-2.5 w-2.5 text-gray-400" />
                  {r.roomNumber}
                  {r.floor != null && (
                    <span className="text-[9px] font-semibold text-gray-400">
                      · F{r.floor}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssigneePanel({
  assignedTo,
  isMine,
}: {
  assignedTo: AssigneePublic;
  isMine?: boolean;
}) {
  // A group claimed by someone else stays anonymous — a teacher can't see who
  // holds a duty they don't own. Only the viewer's own group shows a name/contact.
  if (!isMine) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
          Occupied
        </p>
        <p className="mt-0.5 text-sm font-semibold">Assigned to another teacher</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 shadow-sm"
      title={[
        assignedTo.name,
        assignedTo.designation || "",
        assignedTo.department || "",
        assignedTo.phone || assignedTo.email,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
        Owned by you
      </p>
      <p className="mt-0.5 text-sm font-bold">{assignedTo.name}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-90">
        {assignedTo.department && <span>{assignedTo.department}</span>}
        {assignedTo.phone && (
          <span>
            {assignedTo.department ? "· " : ""}
            {assignedTo.phone}
          </span>
        )}
      </p>
    </div>
  );
}
