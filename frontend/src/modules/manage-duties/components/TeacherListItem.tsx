import { Link } from "react-router-dom";
import { TeacherWithStats } from "../types";
import type { UserRole } from "@/shared/lib/types";
import { ChevronRight } from "lucide-react";
import RoleBadge from "@/shared/components/RoleBadge";
import { WhatsAppIcon } from "@/shared/components";
import { waLink } from "@/shared/lib/whatsapp";

interface TeacherListItemProps {
  teacher: TeacherWithStats;
}

/** Roles that actually carry invigilation duties. CS is a pure admin role. */
const DUTY_ROLES: UserRole[] = ["invigilator", "rs", "dcs"];

export default function TeacherListItem({ teacher }: TeacherListItemProps) {
  const initials = teacher.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // CS (and any non-teaching) accounts have no duty target, so the
  // Completed/Remaining/Target counts are meaningless — don't show them.
  const hasDutyRole = (teacher.roles || []).some((r) => DUTY_ROLES.includes(r));

  // The whole row navigates to the teacher's detail page, but the WhatsApp
  // link must be independently clickable. Nesting an <a> inside the row <Link>
  // is invalid HTML, so the Link is an absolute full-row overlay behind the
  // (pointer-events-none) content, and only the WhatsApp anchor takes clicks.
  return (
    <div className="group relative flex items-center gap-4 border-b border-gray-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-gray-50">
      <Link
        to={`/manage-duties/${teacher._id}`}
        aria-label={`View ${teacher.name}`}
        className="absolute inset-0"
      />

      {/* Avatar */}
      <div className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white">
        {initials}
      </div>

      {/* Info */}
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {teacher.name}
        </p>
        <p className="truncate text-xs text-gray-500">{teacher.email}</p>
        {teacher.department && (
          <p className="mt-0.5 text-xs text-gray-400">{teacher.department}</p>
        )}
      </div>

      {/* Role badges — one per assigned role */}
      <div className="pointer-events-none flex shrink-0 flex-wrap gap-1">
        {(teacher.roles || []).map((r) => (
          <RoleBadge key={r} role={r} />
        ))}
      </div>

      {/* Stats — fixed width so rows align with the header; CS/non-duty
          accounts show a dash instead of meaningless 0/0/0 counts. */}
      <div className="pointer-events-none hidden w-56 shrink-0 items-center justify-center sm:flex">
        {hasDutyRole ? (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-sm font-bold text-green-600">
                {teacher.dutyStats.completed}
              </p>
              <p className="text-[10px] uppercase text-gray-400">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-amber-600">
                {teacher.dutyStats.remaining}
              </p>
              <p className="text-[10px] uppercase text-gray-400">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-indigo-600">
                {teacher.dutyStats.target}
              </p>
              <p className="text-[10px] uppercase text-gray-400">Target</p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      {/* WhatsApp — opens the teacher's chat; clickable above the row overlay. */}
      {teacher.phone && (
        <a
          href={waLink(teacher.phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Chat with ${teacher.name} on WhatsApp`}
          title="Chat on WhatsApp"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-green-600 transition-colors hover:bg-green-50"
        >
          <WhatsAppIcon className="h-[18px] w-[18px]" />
        </a>
      )}

      {/* Arrow */}
      <ChevronRight className="pointer-events-none h-4 w-4 shrink-0 text-gray-300" />
    </div>
  );
}
