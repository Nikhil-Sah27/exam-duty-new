import { Filter } from "lucide-react";

interface DepartmentFilterProps {
  available: string[];
  selected: string | null;
  onChange: (dept: string | null) => void;
}

export default function DepartmentFilter({
  available,
  selected,
  onChange,
}: DepartmentFilterProps) {
  if (available.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-blue-500" />
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Department
      </label>
      <select
        value={selected || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="cursor-pointer rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <option value="">All Departments</option>
        {available.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {selected && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs font-medium text-gray-500 hover:text-red-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}
