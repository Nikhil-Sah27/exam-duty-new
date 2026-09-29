import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, Hourglass, Loader2 } from "lucide-react";
import { downloadCsv } from "@/shared/lib/csv";
import { useAllTeachersProgress } from "../hooks/useDutyProgress";
import type { AllTeachersFilters } from "../services/dutyCalculationApi";
import type { TeacherDutyProgress } from "../types";

interface DutyAnalyticsTableProps {
  /** Initial filter set — parent can lock these if used as a dept-level view. */
  initialFilters?: AllTeachersFilters;
  /** Hide the filter row (e.g. when the table is embedded in a wider layout). */
  hideFilters?: boolean;
  /** Show a CSV export button (used by the Reports page). */
  enableExport?: boolean;
}

/**
 * Reusable cohort table for CS / admin analytics.  Runs off the same
 * `useAllTeachersProgress` hook that any other admin surface can consume, so
 * numbers stay identical wherever they appear.
 */
export default function DutyAnalyticsTable({
  initialFilters = {},
  hideFilters = false,
  enableExport = false,
}: DutyAnalyticsTableProps) {
  const [filters, setFilters] = useState<AllTeachersFilters>(initialFilters);
  const { data, isLoading, error } = useAllTeachersProgress(filters);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      "teacher-workload.csv",
      ["Teacher", "Email", "Designation", "Department", "Eligible", "Target", "Completed", "Remaining", "%"],
      data.teachers.map((t) => [
        t.name,
        t.email,
        t.designation ?? "",
        t.department ?? "",
        t.eligible ? "Yes" : "No",
        t.target,
        t.completed,
        t.remaining,
        t.percentage,
      ]),
    );
  };

  const totals = useMemo(() => {
    if (!data) return { target: 0, completed: 0, remaining: 0, teachers: 0 };
    return data.teachers.reduce(
      (acc, t) => ({
        target: acc.target + t.target,
        completed: acc.completed + t.completed,
        remaining: acc.remaining + t.remaining,
        teachers: acc.teachers + (t.eligible ? 1 : 0),
      }),
      { target: 0, completed: 0, remaining: 0, teachers: 0 },
    );
  }, [data]);

  return (
    <section className="space-y-4">
      {!hideFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Filters
          </label>

          <select
            value={filters.role || ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                role: (e.target.value || undefined) as AllTeachersFilters["role"],
              }))
            }
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">All roles</option>
            <option value="invigilator">Invigilator</option>
            <option value="rs">RS</option>
            <option value="dcs">DCS</option>
            <option value="cs">CS</option>
          </select>

          <input
            value={filters.department || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, department: e.target.value || undefined }))
            }
            placeholder="Department"
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          />

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={Boolean(filters.eligibleOnly)}
              onChange={(e) =>
                setFilters((f) => ({ ...f, eligibleOnly: e.target.checked }))
              }
            />
            Eligible only
          </label>

          {enableExport && data && (
            <button
              onClick={exportCsv}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculating…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load analytics.
        </div>
      )}

      {data && (
        <>
          <SummaryStrip
            perInvigilatorTarget={data.perInvigilator.target}
            totalDuties={data.perInvigilator.totalDuties}
            eligibleTeachers={data.perInvigilator.eligibleTeachers}
            totals={totals}
          />

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Teacher</th>
                  <th className="px-4 py-2 text-left">Designation</th>
                  <th className="px-4 py-2 text-left">Dept</th>
                  <th className="px-4 py-2 text-right">Target</th>
                  <th className="px-4 py-2 text-right">Completed</th>
                  <th className="px-4 py-2 text-right">Remaining</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.teachers.map((t) => (
                  <Row key={t.teacherId} t={t} />
                ))}
                {data.teachers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-xs text-gray-400"
                    >
                      No teachers match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Row({ t }: { t: TeacherDutyProgress }) {
  const eligible = t.eligible;
  return (
    <tr className={eligible ? "" : "text-gray-400"}>
      <td className="px-4 py-2">
        <div className="font-semibold text-gray-800">{t.name}</div>
        <div className="text-[11px] text-gray-400">{t.email}</div>
      </td>
      <td className="px-4 py-2">
        {t.designation || <span className="text-gray-400">—</span>}
        {!eligible && (
          <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
            excluded
          </span>
        )}
      </td>
      <td className="px-4 py-2">{t.department || "—"}</td>
      <td className="px-4 py-2 text-right font-semibold">{t.target}</td>
      <td className="px-4 py-2 text-right text-emerald-600">{t.completed}</td>
      <td className="px-4 py-2 text-right text-amber-600">{t.remaining}</td>
      <td className="px-4 py-2 text-right text-gray-700">{t.percentage}%</td>
    </tr>
  );
}

function SummaryStrip({
  perInvigilatorTarget,
  totalDuties,
  eligibleTeachers,
  totals,
}: {
  perInvigilatorTarget: number;
  totalDuties: number;
  eligibleTeachers: number;
  totals: { target: number; completed: number; remaining: number; teachers: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="Per invigilator"
        value={perInvigilatorTarget}
        hint={`over ${eligibleTeachers} eligible teacher${eligibleTeachers === 1 ? "" : "s"}`}
        icon={<ClipboardList className="h-4 w-4 text-blue-500" />}
      />
      <Tile
        label="Institution total"
        value={totalDuties}
        hint="duties across all semesters"
        icon={<ClipboardList className="h-4 w-4 text-indigo-500" />}
      />
      <Tile
        label="Completed"
        value={totals.completed}
        hint={`of ${totals.target} target`}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      />
      <Tile
        label="Remaining"
        value={totals.remaining}
        hint="left to close"
        icon={<Hourglass className="h-4 w-4 text-amber-500" />}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {label}
        </span>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-extrabold text-gray-800">{value}</p>
      <p className="text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}
