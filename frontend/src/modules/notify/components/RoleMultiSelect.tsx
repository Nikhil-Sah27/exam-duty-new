import type { UserRole } from "@/shared/lib/types";
import { ROLES, getRoleLabel } from "@/shared/constants/roles";

interface RoleMultiSelectProps {
  selected: UserRole[];
  onChange: (roles: UserRole[]) => void;
}

export default function RoleMultiSelect({
  selected,
  onChange,
}: RoleMultiSelectProps) {
  const toggle = (role: UserRole) => {
    onChange(
      selected.includes(role)
        ? selected.filter((r) => r !== role)
        : [...selected, role],
    );
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Roles to notify
      </label>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const active = selected.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggle(role)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {getRoleLabel(role)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
