import { useState } from "react";
import ExamFilters from "@/modules/exams/components/ExamFilters";
import ExamGroupSection from "@/modules/shared/exams/components/ExamGroupSection";
import { useInvigilatorExamView } from "../hooks/useInvigilatorExams";

export default function InvigilatorExamsPage() {
  const { data: groups, isLoading, error } = useInvigilatorExamView();
  const [filterType, setFilterType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  const allGroups = groups || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Exams</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upcoming and ongoing exams. Open any group to see its schedule and rooms.
        </p>
      </div>

      {allGroups.length > 0 && (
        <ExamFilters
          selectedType={filterType}
          selectedSemester={filterSemester}
          onTypeChange={setFilterType}
          onSemesterChange={setFilterSemester}
        />
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading exams...</p>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load exams. Please try again later.
        </div>
      )}

      {!isLoading && allGroups.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-500">No upcoming exams have been created yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Exams created by the controller will appear here automatically.
          </p>
        </div>
      )}

      {!isLoading && allGroups.length > 0 && (
        <ExamGroupSection
          exams={allGroups}
          selectedType={filterType}
          selectedSemester={filterSemester}
          // Relative href — works for both /invigilator/exams and /rs/exams.
          getCardHref={(g) => g._id}
        />
      )}
    </div>
  );
}
