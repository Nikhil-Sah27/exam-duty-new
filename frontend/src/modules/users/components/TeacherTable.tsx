import { useState, useMemo } from "react";
import { Inbox } from "lucide-react";
import { useUsers } from "../hooks";
import { UserProfile } from "../types";
import type { UserRole } from "@/shared/lib/types";
import TeacherStats from "./TeacherStats";
import TeacherFilters from "./TeacherFilters";
import TeacherRow from "./TeacherRow";

interface TeacherTableProps {
  onCreateClick: () => void;
}

interface Filters {
  search: string;
  role: string;
  department: string;
}

export default function TeacherTable({ onCreateClick }: TeacherTableProps) {
  // Admin table shows deactivated teachers too, pushed to the bottom.
  const { data: users, isLoading, isError, error } = useUsers({
    includeInactive: true,
  });

  const [filters, setFilters] = useState<Filters>({
    search: "",
    role: "",
    department: "",
  });

  const departments = useMemo(() => {
    if (!users) return [];
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const matches = users.filter((u: UserProfile) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.phone || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.role && !u.roles?.includes(filters.role as UserRole)) return false;
      if (filters.department && u.department !== filters.department) return false;
      return true;
    });

    // Active first, deactivated at the bottom; keep name order within each group.
    return [...matches].sort((a, b) => {
      if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, filters]);

  if (isLoading) {
    return <p className="text-gray-500">Loading teachers...</p>;
  }

  if (isError) {
    return <p className="text-red-600">Error: {error.message}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Teachers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all teachers and staff accounts.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          + Add Teacher
        </button>
      </div>

      {/* Stats */}
      <TeacherStats users={users || []} />

      {/* Filters */}
      <TeacherFilters
        filters={filters}
        onChange={setFilters}
        departments={departments}
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm">
          <Inbox className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-400">No teachers found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b border-gray-100 bg-gray-50/80">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">Teacher</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Designation</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user: UserProfile) => (
                <TeacherRow key={user._id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
