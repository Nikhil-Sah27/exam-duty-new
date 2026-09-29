import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { TeacherDutyProgress } from "@/modules/duty-calculation/types";
import { ROLE_LABEL } from "@/modules/duty-calculation/utils/roleEngagement";

interface LowCompletionTeachersProps {
  teachers: TeacherDutyProgress[];
  /** Starting cutoff; the CS can change it inline. */
  defaultThreshold?: number;
}

/** Professor → Associate → Assistant → everything else. */
function designationRank(designation: string | null): number {
  if (designation === "Professor") return 0;
  if (designation === "Associate Professor") return 1;
  if (designation === "Assistant Professor") return 2;
  return 3;
}

/**
 * Teachers whose duty completion is below an (editable) threshold, across every
 * role, sorted by designation. Only rows with a real target are considered — a
 * teacher with no duty load for a role can't be "behind" on it.
 */
export default function LowCompletionTeachers({
  teachers,
  defaultThreshold = 80,
}: LowCompletionTeachersProps) {
  const [threshold, setThreshold] = useState(defaultThreshold);

  const rows = useMemo(() => {
    // The cohort has one row per teacher-role, so a multi-role teacher (e.g. an
    // Associate Professor who is both RS and Invigilator) can be below target in
    // more than one role. Count each teacher once, represented by their worst
    // (lowest-%) below-target role, so the total never exceeds the head count.
    const worstByTeacher = new Map<string, TeacherDutyProgress>();
    for (const t of teachers) {
      if (t.target <= 0 || t.percentage >= threshold) continue;
      const existing = worstByTeacher.get(t.teacherId);
      if (!existing || t.percentage < existing.percentage) {
        worstByTeacher.set(t.teacherId, t);
      }
    }
    return [...worstByTeacher.values()].sort((a, b) => {
      const byDesignation =
        designationRank(a.designation) - designationRank(b.designation);
      if (byDesignation !== 0) return byDesignation;
      return a.name.localeCompare(b.name);
    });
  }, [teachers, threshold]);

  const clampThreshold = (v: number) => Math.max(0, Math.min(100, v));

  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-700">
          Teachers below target
        </h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {rows.length}
        </span>

        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          Below
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) =>
              setThreshold(clampThreshold(Number(e.target.value) || 0))
            }
            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-800"
          />
          %
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          Every teacher with a duty load is at or above {threshold}%.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-5 py-2 text-left">Teacher</th>
                <th className="px-5 py-2 text-left">Role</th>
                <th className="px-5 py-2 text-left">Designation</th>
                <th className="px-5 py-2 text-left">Dept</th>
                <th className="px-5 py-2 text-right">Completed</th>
                <th className="px-5 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.teacherId} className="bg-amber-50/40">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.email}</div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                      {ROLE_LABEL[t.role]}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">
                    {t.designation || "—"}
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">
                    {t.department || "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right text-gray-600">
                    {t.completed} / {t.target}
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-red-600">
                    {t.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
