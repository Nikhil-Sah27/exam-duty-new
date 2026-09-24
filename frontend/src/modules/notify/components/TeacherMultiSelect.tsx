import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useUsers } from "@/modules/users/hooks";
import type { UserProfile } from "@/modules/users/types";
import { getRoleLabel } from "@/shared/constants/roles";

interface TeacherMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TeacherMultiSelect({
  selectedIds,
  onChange,
}: TeacherMultiSelectProps) {
  const { data: users, isLoading } = useUsers();
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const list = users || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const selectedUsers = useMemo(
    () => (users || []).filter((u) => selectedSet.has(u._id)),
    [users, selectedSet],
  );

  const toggle = (user: UserProfile) => {
    onChange(
      selectedSet.has(user._id)
        ? selectedIds.filter((id) => id !== user._id)
        : [...selectedIds, user._id],
    );
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Recipients
          {selectedIds.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {selectedIds.length} selected
            </span>
          )}
        </label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-gray-500 hover:text-red-600"
          >
            Clear all
          </button>
        )}
      </div>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((u) => (
            <span
              key={u._id}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-xs font-medium text-blue-800"
            >
              {u.name}
              <button
                type="button"
                onClick={() => toggle(u)}
                className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                aria-label={`Remove ${u.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or department..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading teachers...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No teachers match.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((u) => {
              const active = selectedSet.has(u._id);
              return (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      active ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {u.name}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {u.email}
                        {u.department ? ` · ${u.department}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {u.roles.map(getRoleLabel).join(", ")}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          active
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
