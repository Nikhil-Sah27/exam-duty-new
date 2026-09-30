import { useMemo, useState } from "react";
import { Loader2, Search, UserCheck } from "lucide-react";
import type { UserRole } from "@/shared/lib/types";
import { useEligibleTeachers } from "@/modules/manage-duties/hooks";
import { useBusyTeacherIds } from "@/modules/duties/hooks";
import { useAllTeachersProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import type { TeacherDutyProgress } from "@/modules/duty-calculation/types";
import type { TimeWindow } from "@/modules/shared/duties/utils/timeConflictUtils";

/**
 * Compact, reusable picker of teachers eligible for a duty role. Eligibility
 * comes from the shared `GET /users?role=` filter (designation → role rules) —
 * this component never re-derives who can hold a role. Clicking [Assign] on a
 * row calls `onAssign(teacherId)`; the parent owns the mutation so the same
 * list drives invigilator, RS-group and DCS-group assignment.
 *
 * Ordering: teachers with the MOST remaining (unmet) duties for this role float
 * to the top so CS naturally fills the people still short of their target first;
 * those who've reached their target sink to the bottom. A name search filters
 * the list.
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
  const { data: progressData } = useAllTeachersProgress({ role });
  const [query, setQuery] = useState("");

  const progressById = useMemo(() => {
    const m = new Map<string, TeacherDutyProgress>();
    progressData?.teachers.forEach((p) => m.set(p.teacherId, p));
    return m;
  }, [progressData]);

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

  const q = query.trim().toLowerCase();
  const filtered = visible.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.department || "").toLowerCase().includes(q) ||
      (t.designation || "").toLowerCase().includes(q),
  );

  // Most remaining duties first; target-met (remaining 0) sinks; tie-break by name.
  const sorted = [...filtered].sort((a, b) => {
    const ra = progressById.get(a._id)?.remaining ?? 0;
    const rb = progressById.get(b._id)?.remaining ?? 0;
    if (rb !== ra) return rb - ra;
    return a.name.localeCompare(b.name);
  });

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

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teacher by name…"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          No teachers match “{query}”.
        </div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
          {sorted.map((t) => {
            const busy = isPending && assigningId === t._id;
            const p = progressById.get(t._id);
            const remaining = p?.remaining ?? 0;
            const reached = p?.reached ?? false;
            return (
              <div
                key={t._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {t.name}
                    </p>
                    {remaining > 0 ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {remaining} left
                      </span>
                    ) : reached ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        target met
                      </span>
                    ) : null}
                  </div>
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
      )}
    </div>
  );
}
