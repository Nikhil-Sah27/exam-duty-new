import { Teacher } from "../types";
import { getRoleLabel, ROLE_BADGE_COLORS_LIGHT } from "@/shared/constants/roles";
import type { UserRole } from "@/shared/lib/types";
import ContactActions from "@/shared/components/ContactActions";
import AssignDutyRoleButton from "./AssignDutyRoleButton";

interface TeacherHeaderProps {
  teacher: Teacher;
}

export default function TeacherHeader({ teacher }: TeacherHeaderProps) {
  const initials = teacher.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white shadow-sm">
      <div className="flex items-center justify-between gap-6">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-bold tracking-wide">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold">{teacher.name}</h1>
            <p className="mt-0.5 text-sm text-gray-300">{teacher.email}</p>
            <div className="mt-2">
              <ContactActions phone={teacher.phone} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(teacher.roles || []).map((r: UserRole) => (
                <span
                  key={r}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS_LIGHT[r]}`}
                >
                  {getRoleLabel(r)}
                </span>
              ))}
              {teacher.department && (
                <span className="text-xs text-gray-400">
                  {teacher.department}
                </span>
              )}
              {teacher.designation && (
                <>
                  <span className="text-gray-600">&middot;</span>
                  <span className="text-xs text-gray-400">
                    {teacher.designation}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: assign button — single-role teachers get a direct link
            into that role's flow; multi-role teachers get a picker so CS
            can choose which role slot to assign for. */}
        <AssignDutyRoleButton
          teacherId={teacher._id}
          teacherName={teacher.name}
          teacherRoles={teacher.roles || []}
        />
      </div>
    </div>
  );
}
