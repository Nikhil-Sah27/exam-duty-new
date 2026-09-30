import { useMemo, useState } from "react";
import { useExamGroups, useDeleteExamGroup } from "../hooks";
import { getExamGroupStatus } from "@/modules/shared/exams/utils/examStatusUtils";
import type { ExamGroup } from "../types";
import ExamGrid from "./ExamGrid";
import ExamFilters from "./ExamFilters";
import ConfirmDeleteModal from "@/shared/components/ConfirmDeleteModal";

export default function ExamsPage() {
  const { data: groups, isLoading } = useExamGroups();
  const deleteMutation = useDeleteExamGroup();

  const [filterType, setFilterType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExamGroup | null>(null);

  const allGroups = groups || [];

  // Department options are the distinct codes present across all exams' rooms.
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const g of allGroups) for (const d of g.departments ?? []) set.add(d);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allGroups]);

  // Status is derived from dates and department from each exam's rooms, so filter
  // here and let the grid group the survivors by type + status as usual.
  const visibleGroups = useMemo(() => {
    let list = allGroups;
    if (filterStatus) {
      list = list.filter((g) => getExamGroupStatus(g) === filterStatus);
    }
    if (filterDepartment) {
      list = list.filter((g) => (g.departments ?? []).includes(filterDepartment));
    }
    return list;
  }, [allGroups, filterStatus, filterDepartment]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Exams</h1>
      </div>

      {/* Filters */}
      {allGroups.length > 0 && (
        <ExamFilters
          selectedType={filterType}
          selectedSemester={filterSemester}
          onTypeChange={setFilterType}
          onSemesterChange={setFilterSemester}
          selectedDepartment={filterDepartment}
          onDepartmentChange={setFilterDepartment}
          departmentOptions={departmentOptions}
          selectedStatus={filterStatus}
          onStatusChange={setFilterStatus}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <p className="text-gray-500">Loading exam groups...</p>
      ) : (
        <ExamGrid
          groups={visibleGroups}
          selectedType={filterType}
          selectedSemester={filterSemester}
          onDelete={(group) => setDeleteTarget(group)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
        title="Delete Exam?"
        message={
          deleteTarget && (
            <>
              <p className="mb-2">
                <span className="font-semibold text-gray-800">
                  {deleteTarget.examType} — Semester {deleteTarget.semester}
                </span>
              </p>
              <p className="mb-2">This will:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>delete schedules</li>
                <li>release teacher duties</li>
                <li>free room allocations</li>
                <li>cancel linked change requests</li>
                <li>notify affected staff</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                This action cannot be undone.
              </p>
            </>
          )
        }
      />
    </div>
  );
}
