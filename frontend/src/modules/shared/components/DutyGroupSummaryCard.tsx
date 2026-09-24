import {
  Building2,
  Calendar,
  Clock,
  Crown,
  DoorOpen,
  Shield,
  Users,
} from "lucide-react";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import type { RSDutyGroup } from "@/modules/rs/select-duty/types";
import type { AssigneePublic } from "@/modules/exams/types";
import { getTeacherDisplayId } from "../utils/assignmentStatusUtils";

const DEPT_COLORS: Record<string, string> = {
  CSE: "bg-blue-100 text-blue-700",
  ECE: "bg-purple-100 text-purple-700",
  ISE: "bg-emerald-100 text-emerald-700",
  ME: "bg-orange-100 text-orange-700",
  MECH: "bg-orange-100 text-orange-700",
  CE: "bg-amber-100 text-amber-700",
  EEE: "bg-rose-100 text-rose-700",
  AIML: "bg-indigo-100 text-indigo-700",
  MBA: "bg-teal-100 text-teal-700",
};

function deptColor(d: string): string {
  return DEPT_COLORS[d.toUpperCase()] || "bg-gray-100 text-gray-700";
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface SummaryRoom {
  examRoomId: string;
  roomNumber: string;
  floor?: number;
  buildingName: string;
}

interface SummaryBuildingBucket {
  buildingName: string;
  rooms: SummaryRoom[];
}

/**
 * Group a flat rooms array by building so the chip block can show
 * "Academic Block: 103, 401 / Lab Block: 205" rather than a flat list
 * of bare room numbers. Stable order: alphabetical by building name.
 */
function groupSummaryRoomsByBuilding(
  rooms: readonly SummaryRoom[],
): SummaryBuildingBucket[] {
  const map = new Map<string, SummaryBuildingBucket>();
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

export interface DutyGroupSummary {
  kind: "DCS" | "RS";
  title: string;
  groupIndex?: number;
  /** Human total such as "1/4" for DCS; omitted for RS. */
  groupTotal?: string;
  buildingName: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: Array<{
    examRoomId: string;
    roomNumber: string;
    floor?: number;
    /** Always supplied so the chip can render "{Block} · {Room}" — required
     *  per spec to disambiguate rooms whose numbers repeat across buildings. */
    buildingName: string;
  }>;
  departments: string[];
  studentCount?: number;
  capacity?: number;
  /** Who currently owns the group, if anyone. */
  assignedTo?: AssigneePublic | null;
  /** True when the viewer themselves own this group. */
  isMine?: boolean;
  /** True when somebody else owns it (occupied / cannot select). */
  isOccupied?: boolean;
}

/**
 * Read-only at-a-glance card for a DCS / RS duty group. Used inside the
 * group details modal and as the embedded panel inside the classroom modal.
 * Picks up the SEE-style gradient hero pattern used elsewhere.
 */
interface DutyGroupSummaryCardProps {
  summary: DutyGroupSummary;
  /** Optional CTA slot (e.g. "Select Group Duty" button). */
  action?: React.ReactNode;
  /** Optional inline note (e.g. conflict explanation). */
  note?: string;
  /** "warn" tints the note red; defaults to neutral. */
  noteTone?: "info" | "warn";
}

export default function DutyGroupSummaryCard({
  summary,
  action,
  note,
  noteTone = "info",
}: DutyGroupSummaryCardProps) {
  const Icon = summary.kind === "DCS" ? Crown : Shield;
  const tonePillClass = summary.isMine
    ? "bg-gradient-to-r from-blue-600 to-indigo-600"
    : summary.isOccupied
      ? "bg-gradient-to-r from-red-500 to-rose-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";
  const toneLabel = summary.isMine
    ? "My Group"
    : summary.isOccupied
      ? "Occupied"
      : "Available";

  return (
    <article className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-blue-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {summary.kind === "DCS"
                ? "Deputy Chief Superintendent"
                : "Room Superintendent"}
            </p>
            <h3 className="text-base font-bold">{summary.title}</h3>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${tonePillClass}`}
        >
          {toneLabel}
        </span>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            icon={<Calendar className="h-3 w-3" />}
            label="Date"
            value={formatDate(summary.date)}
          />
          <Stat
            icon={<Clock className="h-3 w-3" />}
            label="Time"
            value={`${formatTime(summary.startTime)} – ${formatTime(summary.endTime)}`}
          />
          <Stat
            icon={<DoorOpen className="h-3 w-3" />}
            label="Rooms"
            value={String(summary.rooms.length)}
          />
          <Stat
            icon={<Users className="h-3 w-3" />}
            label={summary.kind === "DCS" ? "Students" : "Building"}
            value={
              summary.kind === "DCS"
                ? String(summary.studentCount ?? 0)
                : summary.buildingName
            }
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Rooms in Group
          </p>
          {/* Group by building so users see at a glance "Academic Block:
              103, 401, 403 / Lab Block: 205" rather than a flat list of
              ambiguous room numbers. */}
          <div className="space-y-2">
            {groupSummaryRoomsByBuilding(summary.rooms).map((b) => (
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

        {summary.departments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.departments.map((d) => (
              <span
                key={d}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${deptColor(d)}`}
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {summary.assignedTo && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs shadow-sm ${
              summary.isMine
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            title={[
              summary.assignedTo.name,
              summary.assignedTo.designation || "",
              summary.assignedTo.department || "",
              summary.assignedTo.phone || summary.assignedTo.email,
            ]
              .filter(Boolean)
              .join("\n")}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              {summary.isMine ? "Owned by you" : "Assigned to"}
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {summary.assignedTo.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-90">
              <span className="font-semibold">
                ID: {getTeacherDisplayId(summary.assignedTo)}
              </span>
              {summary.assignedTo.department && (
                <span>· {summary.assignedTo.department}</span>
              )}
              {summary.assignedTo.phone && (
                <span>· {summary.assignedTo.phone}</span>
              )}
            </p>
          </div>
        )}

        {note && (
          <p
            className={`text-[11px] ${noteTone === "warn" ? "text-red-700" : "text-gray-500"}`}
          >
            {note}
          </p>
        )}

        {action && <div>{action}</div>}
      </div>
    </article>
  );
}

function Stat({
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

/**
 * Adapter: project a DcsGroup into the common summary shape used by the
 * card. Keeps the card decoupled from DCS-specific field naming so the same
 * component can render RS groups too.
 */
export function dcsGroupToSummary(
  group: DcsGroup,
  myUserId: string | null | undefined,
  /**
   * Cross-schedule display ordinal. When omitted the function falls back to
   * the backend per-schedule `groupIndex` — fine for single-card surfaces
   * but produces "Group #1" on every card across multiple schedules.
   */
  displayOrdinal?: number | null,
): DutyGroupSummary {
  const assignedToMe = Boolean(
    group.assignedTeacher && group.assignedTeacher._id === myUserId,
  );
  const occupied = Boolean(group.assignedTeacher) && !assignedToMe;
  const assignedTo: AssigneePublic | null = group.assignedTeacher
    ? {
        _id: group.assignedTeacher._id,
        name: group.assignedTeacher.name,
        email: group.assignedTeacher.email,
        phone: group.assignedTeacher.phone ?? null,
        roles: ["dcs"],
        department: group.assignedTeacher.department ?? null,
        designation: null,
      }
    : null;
  const ordinal = displayOrdinal ?? group.groupIndex;
  return {
    kind: "DCS",
    title: `DCS Duty Group #${ordinal}`,
    groupIndex: group.groupIndex,
    groupTotal: `${group.groupIndex}/${group.dcsRequired}`,
    buildingName: group.assignedRooms[0]?.room.building?.name ?? "—",
    date: group.schedule.date,
    startTime: group.schedule.startTime,
    endTime: group.schedule.endTime,
    rooms: group.assignedRooms.map((r) => ({
      examRoomId: r._id,
      roomNumber: r.room.roomNumber,
      floor: r.room.floor,
      buildingName: r.room.building?.name ?? "—",
    })),
    departments: group.assignedDepartments,
    studentCount: group.assignedStudents,
    assignedTo,
    isMine: assignedToMe,
    isOccupied: occupied,
  };
}

export function rsGroupToSummary(group: RSDutyGroup): DutyGroupSummary {
  return {
    kind: "RS",
    title: `${group.buildingName} — ${group.rangeLabel}`,
    buildingName: group.buildingName,
    date: group.date,
    startTime: group.startTime,
    endTime: group.endTime,
    rooms: group.rooms.map((r) => ({
      examRoomId: r.examRoomId,
      roomNumber: r.roomNumber,
      // RS groups are always single-building (partitioned by building during
      // grouping), so every room inherits the group's building name.
      buildingName: group.buildingName,
    })),
    departments: group.departments,
    capacity: group.rooms.reduce((sum, r) => sum + r.capacity, 0),
    // RS groups are derived client-side and don't carry a single assignee —
    // every room has its own duty. The classroom modal still tells the
    // viewer if the slot is occupied via the per-role assignee on flags.
    assignedTo: null,
    isMine: false,
    isOccupied: group.allAssigned,
  };
}
