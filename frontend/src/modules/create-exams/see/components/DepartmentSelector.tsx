import { useDepartments } from "@/modules/departments/hooks";

interface DepartmentSelectorProps {
  /** Currently-selected department ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Locked once courses have been scheduled (changing the set resets them). */
  disabled?: boolean;
}

/**
 * Multi-select department picker. Clicking a department toggles it in/out of
 * the selection — SEE exams can now be created for several departments at once,
 * each becoming its own separate exam card.
 */
export default function DepartmentSelector({
  value,
  onChange,
  disabled,
}: DepartmentSelectorProps) {
  const { data: departments = [], isLoading } = useDepartments();

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        Select Departments
      </h3>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading departments...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {departments.map((dept) => {
            const selected = value.includes(dept._id);
            return (
              <button
                key={dept._id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(dept._id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {dept.code}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
