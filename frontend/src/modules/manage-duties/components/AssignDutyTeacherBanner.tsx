import type { Teacher } from "../types";
import type { TeacherDutyProgress } from "@/modules/duty-calculation/types";

interface Props {
  teacher: Teacher;
  progress: TeacherDutyProgress | null;
}

/**
 * Top banner shown across every step of the CS "assign duty" wizard so the
 * CS always sees which teacher they're assigning to and how their workload
 * stands. Progress can be null while the /duty-calculation call is in flight.
 */
export default function AssignDutyTeacherBanner({ teacher, progress }: Props) {
  const initials = teacher.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white shadow-sm">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">
          Assign Invigilator Duty
        </h1>
        <p className="mt-0.5 text-xs text-gray-400">
          Select an exam, pick a classroom, and confirm.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold tracking-wide">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold">{teacher.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-300">
              {teacher.designation && <span>{teacher.designation}</span>}
              {teacher.designation && teacher.department && (
                <span className="text-gray-600">&middot;</span>
              )}
              {teacher.department && <span>{teacher.department}</span>}
            </div>
          </div>
        </div>

        <div className="ml-auto grid grid-cols-3 gap-3">
          <Tile label="Target" value={progress?.target} />
          {/* "Assigned" = active duties/groups (upcoming + ongoing + completed) —
              the same count that drives the target-reached block. */}
          <Tile label="Assigned" value={progress?.assigned} />
          <Tile
            label="Remaining"
            value={
              progress
                ? Math.max(0, progress.target - progress.assigned)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="min-w-[86px] rounded-lg bg-white/10 px-4 py-2.5 text-center">
      <p className="text-lg font-bold leading-tight">
        {value ?? <span className="text-white/40">—</span>}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-300">
        {label}
      </p>
    </div>
  );
}
