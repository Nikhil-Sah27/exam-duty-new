import {
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  Crown,
  DoorOpen,
  Shield,
} from "lucide-react";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import type { RSDutyGroup } from "@/modules/rs/select-duty/types";
import { useAuthStore } from "@/shared/store/auth.store";
import type { OperationalRoleKey } from "../utils/assignmentStatusUtils";
import ViewDutyGroupButton from "./ViewDutyGroupButton";

/**
 * Lightweight room descriptor used by the rooms list — carries enough to
 * render "{Building} · {Room}" chips and group by building when a duty
 * group spans more than one block.
 */
interface RoomEntry {
  examRoomId: string;
  roomNumber: string;
  buildingName: string;
  floor?: number;
}

interface BuildingBucket {
  buildingName: string;
  rooms: RoomEntry[];
}

function groupRoomsByBuilding(rooms: readonly RoomEntry[]): BuildingBucket[] {
  const map = new Map<string, BuildingBucket>();
  for (const r of rooms) {
    const key = r.buildingName || "—";
    const bucket = map.get(key);
    if (bucket) bucket.rooms.push(r);
    else map.set(key, { buildingName: key, rooms: [r] });
  }
  return [...map.values()].sort((a, b) =>
    a.buildingName.localeCompare(b.buildingName),
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

interface DutyGroupInfoPanelProps {
  viewerRole: OperationalRoleKey;
  dcsGroup?: DcsGroup | null;
  rsGroup?: RSDutyGroup | null;
  /**
   * Cross-schedule display ordinal for the DCS group. When supplied, the
   * panel labels the group "DCS Duty Group #N" using this number instead
   * of the per-schedule backend `groupIndex` (which is always 1 for
   * single-chunk schedules and confuses the user).
   */
  dcsDisplayOrdinal?: number | null;
  isLoading?: boolean;
  onViewGroup: () => void;
}

/**
 * Sits inside the classroom-details modal in place of the per-room
 * "Select Duty" action for DCS / RS viewers. Tells the user: "this room
 * is part of group X with these other rooms; click View Duty Group to
 * see the full group and claim it."
 *
 * Pure presentation — does not call any APIs.  Group lookup is performed by
 * the parent via `useGroupForRoom` so the same panel works for both DCS and
 * RS without duplicating data plumbing.
 */
export default function DutyGroupInfoPanel({
  viewerRole,
  dcsGroup,
  rsGroup,
  dcsDisplayOrdinal,
  isLoading,
  onViewGroup,
}: DutyGroupInfoPanelProps) {
  const myUserId = useAuthStore((s) => s.user?.id);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-700">
        Locating the duty group…
      </div>
    );
  }

  if (viewerRole === "dcs") {
    if (!dcsGroup) {
      return (
        <NoGroupBlock
          message="No DCS duty group found for this room."
          detail="The grouping is generated when the exam is created. Contact the controller if this looks wrong."
        />
      );
    }
    const isMine =
      dcsGroup.assignedTeacher && dcsGroup.assignedTeacher._id === myUserId;
    const isOccupied = Boolean(dcsGroup.assignedTeacher) && !isMine;
    const ordinal = dcsDisplayOrdinal ?? dcsGroup.groupIndex;
    return (
      <Shell
        kind="DCS"
        title={`DCS Duty Group #${ordinal}`}
        subtitle={`${dcsGroup.assignedRooms.length} rooms · serves ${dcsGroup.assignedStudents} students`}
        date={dcsGroup.schedule.date}
        startTime={dcsGroup.schedule.startTime}
        endTime={dcsGroup.schedule.endTime}
        rooms={dcsGroup.assignedRooms.map((r) => ({
          examRoomId: r._id,
          roomNumber: r.room.roomNumber,
          buildingName: r.room.building?.name ?? "—",
          floor: r.room.floor,
        }))}
        isMine={Boolean(isMine)}
        isOccupied={isOccupied}
        assignedTo={dcsGroup.assignedTeacher?.name ?? null}
        onViewGroup={onViewGroup}
      />
    );
  }

  if (viewerRole === "rs") {
    if (!rsGroup) {
      return (
        <NoGroupBlock
          message="No RS duty group found for this room."
          detail="Groups update when rooms are added; refresh the page if you just changed the exam."
        />
      );
    }
    return (
      <Shell
        kind="RS"
        title={`${rsGroup.buildingName} — ${rsGroup.rangeLabel}`}
        subtitle={`${rsGroup.rooms.length} rooms in ${rsGroup.buildingName}`}
        date={rsGroup.date}
        startTime={rsGroup.startTime}
        endTime={rsGroup.endTime}
        rooms={rsGroup.rooms.map((r) => ({
          examRoomId: r.examRoomId,
          roomNumber: r.roomNumber,
          buildingName: rsGroup.buildingName,
        }))}
        isMine={false}
        isOccupied={rsGroup.allAssigned}
        assignedTo={null}
        onViewGroup={onViewGroup}
      />
    );
  }

  // Invigilator never reaches this component — render null defensively.
  return null;
}

function Shell(props: {
  kind: "DCS" | "RS";
  title: string;
  subtitle: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: RoomEntry[];
  isMine: boolean;
  isOccupied: boolean;
  assignedTo: string | null;
  onViewGroup: () => void;
}) {
  const Icon = props.kind === "DCS" ? Crown : Shield;
  const tonePill = props.isMine
    ? "bg-gradient-to-r from-blue-600 to-indigo-600"
    : props.isOccupied
      ? "bg-gradient-to-r from-red-500 to-rose-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";
  const toneLabel = props.isMine
    ? "My Group"
    : props.isOccupied
      ? "Occupied"
      : "Available";

  return (
    <article className="space-y-3 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-3 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              This classroom belongs to
            </p>
            <p className="text-sm font-bold text-gray-800">{props.title}</p>
            <p className="text-[11px] text-gray-500">{props.subtitle}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${tonePill}`}
        >
          {toneLabel}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(props.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(props.startTime)} – {formatTime(props.endTime)}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Rooms in Group
        </p>
        <div className="space-y-1.5">
          {groupRoomsByBuilding(props.rooms).map((b) => (
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

      {/* The occupant's name shows only when the group is the viewer's own.
          Groups claimed by someone else read as "Occupied" with no name — a
          teacher can't see who holds a duty they don't own. */}
      {props.isMine && props.assignedTo ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800">
          <span className="font-semibold uppercase tracking-wider">
            Owned by you
          </span>
          <span className="ml-1 font-semibold">{props.assignedTo}</span>
        </p>
      ) : props.isOccupied ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">
          <span className="font-semibold uppercase tracking-wider">
            Occupied
          </span>
          <span className="ml-1">— assigned to another teacher</span>
        </p>
      ) : null}

      <div className="flex justify-end">
        <ViewDutyGroupButton onClick={props.onViewGroup} />
      </div>
    </article>
  );
}

function NoGroupBlock({
  message,
  detail,
}: {
  message: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <p className="font-semibold">{message}</p>
        <p className="mt-0.5 text-[11px] text-amber-700/90">{detail}</p>
      </div>
    </div>
  );
}
