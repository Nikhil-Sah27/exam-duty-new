import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadCsv } from "@/shared/lib/csv";
import { useAllTeachersProgress } from "../hooks/useDutyProgress";
import type { AllTeachersFilters } from "../services/dutyCalculationApi";
import type { TeacherDutyProgress } from "../types";
import { computeRoleEngagement, ROLE_LABEL } from "../utils/roleEngagement";
import RoleCompletionCard from "./RoleCompletionCard";

/**
 * Non-academic departments that house admin accounts (CS / exam staff) rather
 * than invigilating faculty — excluded from the department filter so the
 * workload report lists only real teaching departments.
 */
const NON_ACADEMIC_DEPARTMENTS = new Set(["Administration"]);

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
  // Department is filtered client-side: `User.department` is free-text and often
  // doesn't match a canonical department name, so the dropdown is built from the
  // departments actually present in the data and matched exactly here.
  const [department, setDepartment] = useState(initialFilters.department ?? "");
  const { data, isLoading, error } = useAllTeachersProgress({
    role: filters.role,
  });

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of data?.teachers ?? [])
      if (t.department && !NON_ACADEMIC_DEPARTMENTS.has(t.department))
        set.add(t.department);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const teachers = useMemo(() => {
    const list = data?.teachers ?? [];
    return department ? list.filter((t) => t.department === department) : list;
  }, [data, department]);

  // Group a teacher's per-role rows so name/designation/department render once
  // (spanning the roles) and each role shows its own duty numbers. Within a
  // teacher RS is listed above Invigilator. Teacher blocks are ordered by their
  // primary (top) role — DCS, then RS, then Invigilator — and within RS by
  // designation (Professor before Associate Professor); ties break by name.
  const grouped = useMemo(() => {
    // Sub-row order within a teacher: RS above Invigilator.
    const subRowOrder: Record<TeacherDutyProgress["role"], number> = {
      rs: 0,
      invigilator: 1,
      dcs: 2,
      cs: 3,
    };
    // Block order across teachers: DCS → RS → Invigilator.
    const blockOrder: Record<TeacherDutyProgress["role"], number> = {
      dcs: 0,
      rs: 1,
      invigilator: 2,
      cs: 3,
    };
    const designationRank = (designation: string | null) => {
      if (designation === "Professor") return 0;
      if (designation === "Associate Professor") return 1;
      if (designation === "Assistant Professor") return 2;
      return 3;
    };

    const map = new Map<string, TeacherDutyProgress[]>();
    for (const t of teachers) {
      const arr = map.get(t.teacherId) ?? [];
      arr.push(t);
      map.set(t.teacherId, arr);
    }
    const groups = [...map.values()].map((rows) =>
      [...rows].sort((a, b) => subRowOrder[a.role] - subRowOrder[b.role]),
    );
    return groups.sort((a, b) => {
      const byRole = blockOrder[a[0].role] - blockOrder[b[0].role];
      if (byRole !== 0) return byRole;
      const byDesignation =
        designationRank(a[0].designation) - designationRank(b[0].designation);
      if (byDesignation !== 0) return byDesignation;
      return a[0].name.localeCompare(b[0].name);
    });
  }, [teachers]);

  const exportCsv = () => {
    if (!data) return;
    // Mirror the grouped table: a teacher's identity (name/email/designation/
    // department) is written only on their first role row; the remaining role
    // rows leave those blank and carry just the role + its duty numbers.
    const rows = grouped.flatMap((teacherRows) =>
      teacherRows.map((t, i) => [
        i === 0 ? t.name : "",
        i === 0 ? t.email : "",
        ROLE_LABEL[t.role],
        i === 0 ? t.designation ?? "" : "",
        i === 0 ? t.department ?? "" : "",
        t.target,
        t.completed,
        t.remaining,
        t.percentage,
      ]),
    );
    downloadCsv(
      "teacher-workload.csv",
      ["Teacher", "Email", "Role", "Designation", "Department", "Target", "Completed", "Remaining", "%"],
      rows,
    );
  };

  const roleEngagement = useMemo(
    () => computeRoleEngagement(teachers),
    [teachers],
  );

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
          </select>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">All departments</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

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
          {roleEngagement.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roleEngagement.map((r) => (
                <RoleCompletionCard key={r.role} item={r} />
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Teacher</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Designation</th>
                  <th className="px-4 py-2 text-left">Dept</th>
                  <th className="px-4 py-2 text-right">Target</th>
                  <th className="px-4 py-2 text-right">Completed</th>
                  <th className="px-4 py-2 text-right">Remaining</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grouped.map((rows) => (
                  <TeacherGroup key={rows[0].teacherId} rows={rows} />
                ))}
                {teachers.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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

/**
 * One teacher rendered as a block: identity (name/designation/department) shown
 * once via row-spanning cells, with a sub-row per duty role carrying that role's
 * target / completed / remaining. A single-role teacher is just one sub-row.
 */
function TeacherGroup({ rows }: { rows: TeacherDutyProgress[] }) {
  const first = rows[0];
  const span = rows.length;
  return (
    <>
      {rows.map((t, i) => (
        <tr key={t.role}>
          {i === 0 && (
            <td rowSpan={span} className="px-4 py-3 align-middle">
              <div className="text-base font-bold text-gray-800">{first.name}</div>
              <div className="text-xs text-gray-400">{first.email}</div>
            </td>
          )}
          <td className="px-4 py-2">
            <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {ROLE_LABEL[t.role]}
            </span>
          </td>
          {i === 0 && (
            <td
              rowSpan={span}
              className="px-4 py-3 align-middle text-sm text-gray-700"
            >
              {first.designation || <span className="text-gray-400">—</span>}
            </td>
          )}
          {i === 0 && (
            <td
              rowSpan={span}
              className="px-4 py-3 align-middle text-sm text-gray-700"
            >
              {first.department || "—"}
            </td>
          )}
          <td className="px-4 py-2 text-right font-semibold">{t.target}</td>
          <td className="px-4 py-2 text-right text-emerald-600">{t.completed}</td>
          <td className="px-4 py-2 text-right text-amber-600">{t.remaining}</td>
          <td className="px-4 py-2 text-right text-gray-700">{t.percentage}%</td>
        </tr>
      ))}
    </>
  );
}

