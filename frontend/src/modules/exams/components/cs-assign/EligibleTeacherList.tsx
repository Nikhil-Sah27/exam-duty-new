import { Loader2, UserCheck } from "lucide-react";
import type { UserRole } from "@/shared/lib/types";
import { useEligibleTeachers } from "@/modules/manage-duties/hooks";
import { useBusyTeacherIds } from "@/modules/duties/hooks";
import type { TimeWindow } from "@/modules/shared/duties/utils/timeConflictUtils";

/**
 * Compact, reusable picker of teachers eligible for a duty role. Eligibility
 * comes from the shared `GET /users?role=` filter (designation → role rules) —
 * this component never re-derives who can hold a role. Clicking [Assign] on a
 * row calls `onAssign(teacherId)`; the parent owns the mutation so the same
 * list drives invigilator, RS-group and DCS-group assignment.
 */
export default function EligibleTeacherList({
  role,
  onAssign,
  assigningId,
  isPending,
  disabled = false,
  actionLabel = "Assign",
  conflict,
}: {
  role: Exclude<UserRole, "cs">;
  onAssign: (teacherId: string) => void;
  assigningId: string | null;
  isPending: boolean;
  disabled?: boolean;
  actionLabel?: string;
  /** When set, teachers already on an assigned duty overlapping this
   *  date/time window are hidden (they'd be rejected as a conflict anyway). */
  conflict?: TimeWindow;
}) {
  const { data: teachers, isLoading, error } = useEligibleTeachers(role);
  const busyIds = useBusyTeacherIds(conflict);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading eligible teachers…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        {(error as Error).message}
      </div>
    );
  }

  if (!teachers || teachers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
        No eligible teachers found for this role.
      </div>
    );
  }

  // Hide teachers who already hold a duty overlapping this slot — the backend
  // would reject them, so they should never appear as assignable options.
  const visible = teachers.filter((t) => !busyIds.has(t._id));
  const hiddenCount = teachers.length - visible.length;

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
        All eligible teachers already have a duty at this time.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Eligible Teachers
        </p>
        {hiddenCount > 0 && (
          <p className="text-[10px] text-gray-400">
            {hiddenCount} busy at this time · hidden
          </p>
        )}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
        {visible.map((t) => {
          const busy = isPending && assigningId === t._id;
          return (
            <div
              key={t._id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {t.name}
                </p>
                <p className="truncate text-[11px] text-gray-500">
                  {t.designation || "—"}
                  {t.designation && t.department ? " · " : ""}
                  {t.department || ""}
                </p>
              </div>
              <button
                onClick={() => onAssign(t._id)}
                disabled={disabled || isPending}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Assigning…
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" /> {actionLabel}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
