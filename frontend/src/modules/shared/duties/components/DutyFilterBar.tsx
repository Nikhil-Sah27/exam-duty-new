import { X } from "lucide-react";
import type { DutyFilters } from "../types";

const EXAM_TYPES = ["IA1", "IA2", "IA3", "SEE"];
const SEMESTERS = Array.from({ length: 8 }, (_, i) => String(i + 1));

interface DutyFilterBarProps {
  filters: DutyFilters;
  availableDepartments: string[];
  onChange: <K extends keyof DutyFilters>(key: K, value: DutyFilters[K]) => void;
  onClear: () => void;
}

export default function DutyFilterBar({
  filters,
  availableDepartments,
  onChange,
  onClear,
}: DutyFilterBarProps) {
  const hasAnyFilter = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Filter
      </span>

      <input
        type="date"
        value={filters.date}
        onChange={(e) => onChange("date", e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <select
        value={filters.examType}
        onChange={(e) => onChange("examType", e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All exam types</option>
        {EXAM_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        value={filters.semester}
        onChange={(e) => onChange("semester", e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All semesters</option>
        {SEMESTERS.map((s) => (
          <option key={s} value={s}>
            Sem {s}
          </option>
        ))}
      </select>

      <select
        value={filters.department}
        onChange={(e) => onChange("department", e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All departments</option>
        {availableDepartments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {hasAnyFilter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
