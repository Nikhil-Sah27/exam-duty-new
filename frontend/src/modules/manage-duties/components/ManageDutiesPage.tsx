import { useState, useMemo } from "react";
import { useTeachers } from "../hooks";
import type { UserRole } from "@/shared/lib/types";
import { useAllTeachersProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import { TeacherFilters, TeacherWithStats } from "../types";
import TeacherListItem from "./TeacherListItem";
import TeacherFiltersBar from "./TeacherFiltersBar";

export default function ManageDutiesPage() {
  const { data: teachers, isLoading, isError, error } = useTeachers();
  // Authoritative per-teacher progress — the same server-computed source the
  // teacher-detail tiles, assign wizards and reports read, so the list never
  // recomputes targets. One row per (teacher × duty-role held); we sum those
  // rows per teacher so a dual-role teacher shows a combined figure.
  const { data: progress } = useAllTeachersProgress();

  const [filters, setFilters] = useState<TeacherFilters>({
    search: "",
    department: "",
    role: "",
  });

  const statsByTeacher = useMemo(() => {
    const map = new Map<string, TeacherWithStats["dutyStats"]>();
    (progress?.teachers ?? []).forEach((row) => {
      const prev = map.get(row.teacherId) ?? {
        completed: 0,
        remaining: 0,
        target: 0,
      };
      map.set(row.teacherId, {
        completed: prev.completed + row.completed,
        remaining: prev.remaining + row.remaining,
        target: prev.target + row.target,
      });
    });
    return map;
  }, [progress]);

  const teachersWithStats: TeacherWithStats[] = useMemo(() => {
    if (!teachers) return [];
    return teachers.map((t) => ({
      ...t,
      dutyStats: statsByTeacher.get(t._id) ?? {
        completed: 0,
        remaining: 0,
        target: 0,
      },
    }));
  }, [teachers, statsByTeacher]);

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    if (!teachers) return [];
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set).sort();
  }, [teachers]);

  // Apply filters
  const filtered = useMemo(() => {
    return teachersWithStats.filter((t) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.department && t.department !== filters.department) return false;
      if (filters.role && !t.roles?.includes(filters.role as UserRole)) return false;
      return true;
    });
  }, [teachersWithStats, filters]);

  if (isLoading) {
    return <p className="text-gray-500">Loading teachers...</p>;
  }

  if (isError) {
    return <p className="text-red-600">Error: {error.message}</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Manage Duties</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a teacher to view details and assign duties.
        </p>
      </div>

      <div className="mb-5">
        <TeacherFiltersBar
          filters={filters}
          onChange={setFilters}
          departments={departments}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No teachers found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* List header */}
          <div className="flex items-center border-b border-gray-100 bg-gray-50/80 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <span className="flex-1">Teacher</span>
            <span className="hidden w-20 text-center sm:block">Role</span>
            <span className="hidden w-56 text-center sm:block">
              Duty Stats
            </span>
            <span className="w-6" />
          </div>
          {filtered.map((t) => (
            <TeacherListItem key={t._id} teacher={t} />
          ))}
        </div>
      )}
    </div>
  );
}
