import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  DoorOpen,
  Building2,
  Users,
  Crown,
  Shield,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import type { DashboardDutyItem, DashboardRoleLabel } from "../types";

const ROLE_STYLES: Record<
  DashboardRoleLabel,
  { gradient: string; ring: string; pill: string; icon: typeof Crown }
> = {
  Invigilator: {
    gradient: "from-emerald-50 via-white to-teal-50",
    ring: "border-emerald-200 hover:border-emerald-400",
    pill: "bg-gradient-to-r from-emerald-500 to-teal-500",
    icon: UserCheck,
  },
  RS: {
    gradient: "from-amber-50 via-white to-orange-50",
    ring: "border-amber-200 hover:border-amber-400",
    pill: "bg-gradient-to-r from-amber-500 to-orange-500",
    icon: Shield,
  },
  DCS: {
    gradient: "from-blue-50 via-white to-indigo-50",
    ring: "border-blue-200 hover:border-blue-400",
    pill: "bg-gradient-to-r from-blue-600 to-indigo-600",
    icon: Crown,
  },
};

const COMPLETED_OVERRIDE = "opacity-80 grayscale-[0.2]";

const DEPT_COLORS: Record<string, string> = {
  CSE: "bg-blue-100 text-blue-700",
  ECE: "bg-purple-100 text-purple-700",
  ISE: "bg-emerald-100 text-emerald-700",
  ME: "bg-orange-100 text-orange-700",
  MECH: "bg-orange-100 text-orange-700",
  CE: "bg-amber-100 text-amber-700",
  EEE: "bg-rose-100 text-rose-700",
  AIML: "bg-indigo-100 text-indigo-700",
};

function getDeptColor(d: string): string {
  return DEPT_COLORS[d.toUpperCase()] || "bg-gray-100 text-gray-600";
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface DashboardDutyCardProps {
  item: DashboardDutyItem;
  /** Render style: vibrant upcoming, or muted completed. */
  variant?: "upcoming" | "completed";
}

export default function DashboardDutyCard({
  item,
  variant = "upcoming",
}: DashboardDutyCardProps) {
  const style = ROLE_STYLES[item.roleLabel];
  const RoleIcon = style.icon;
  const muted = variant === "completed";

  const primaryBuilding = item.rooms.find((r) => r.building)?.building;
  const buildingCount = new Set(
    item.rooms.map((r) => r.building).filter(Boolean) as string[],
  ).size;

  const content = (
    <article
      className={`group/card relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-4 shadow-sm transition-all hover:shadow-md ${style.ring} ${style.gradient} ${muted ? COMPLETED_OVERRIDE : ""}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.examType && (
            <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
              {item.examType}
            </span>
          )}
          {item.semester !== undefined && item.semester !== "" && (
            <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200">
              Sem {item.semester}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${style.pill}`}
          >
            <RoleIcon className="h-2.5 w-2.5" />
            {item.roleLabel}
          </span>
          {muted && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              Completed
            </span>
          )}
        </div>
        {(item.href || item.onClick) && (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover/card:translate-x-1 group-hover/card:text-gray-500" />
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(item.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(item.startTime)} – {formatTime(item.endTime)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-white/40">
        <div className="flex items-center gap-1.5">
          <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
          <div className="text-[11px] leading-tight">
            <p className="font-bold text-gray-800">{item.rooms.length}</p>
            <p className="text-[10px] text-gray-500">
              {item.rooms.length === 1 ? "Room" : "Rooms"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {item.students !== undefined ? (
            <>
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <div className="text-[11px] leading-tight">
                <p className="font-bold text-gray-800">{item.students}</p>
                <p className="text-[10px] text-gray-500">Students</p>
              </div>
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              <div className="text-[11px] leading-tight">
                <p className="truncate font-bold text-gray-800">
                  {primaryBuilding || "—"}
                </p>
                <p className="text-[10px] text-gray-500">
                  {buildingCount > 1 ? `+${buildingCount - 1} more` : "Building"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {item.rooms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.rooms.slice(0, 6).map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-gray-200"
              title={
                r.building
                  ? `${r.building} · Room ${r.roomNumber}${r.floor !== undefined ? ` · Floor ${r.floor}` : ""}`
                  : undefined
              }
            >
              <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
              {r.roomNumber}
              {r.floor !== undefined && (
                <span className="text-[11px] font-semibold text-gray-400">
                  · F{r.floor}
                </span>
              )}
            </span>
          ))}
          {item.rooms.length > 6 && (
            <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-600">
              +{item.rooms.length - 6}
            </span>
          )}
        </div>
      )}

      {item.departments.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-white/60 pt-2">
          {item.departments.map((d) => (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getDeptColor(d)}`}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </article>
  );

  if (item.onClick) {
    return (
      <button onClick={item.onClick} className="text-left">
        {content}
      </button>
    );
  }
  if (item.href) {
    return <Link to={item.href}>{content}</Link>;
  }
  return content;
}
