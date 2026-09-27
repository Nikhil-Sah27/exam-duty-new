import { useState } from "react";
import { useExamGroups, useDeleteExamGroup } from "../hooks";
import type { ExamGroup } from "../types";
import ExamGrid from "./ExamGrid";
import ExamFilters from "./ExamFilters";
import ConfirmDeleteModal from "@/shared/components/ConfirmDeleteModal";

export default function ExamsPage() {
  const { data: groups, isLoading } = useExamGroups();
  const deleteMutation = useDeleteExamGroup();

  const [filterType, setFilterType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExamGroup | null>(null);

  const allGroups = groups || [];

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
        />
      )}

      {/* Content */}
      {isLoading ? (
        <p className="text-gray-500">Loading exam groups...</p>
      ) : (
        <ExamGrid
          groups={allGroups}
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
