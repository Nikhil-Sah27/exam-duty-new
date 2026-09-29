import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTeacherDetails } from "../hooks";
import { useTeacherDutyProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import { useExamGroups } from "@/modules/exams/hooks";
import ExamFilters from "@/modules/exams/components/ExamFilters";
import ExamGroupSection from "@/modules/shared/exams/components/ExamGroupSection";
import AssignDutyTeacherBanner from "./AssignDutyTeacherBanner";
import TargetReachedNotice from "./TargetReachedNotice";

/**
 * Step 1 of the CS "assign duty" wizard — render the same visual exam
 * grid the /exams page uses, but scoped as a teacher-assignment context.
 * Reuses <ExamGroupSection> so this stays visually identical to /exams.
 */
export default function AssignDutyExamsPage() {
  const { id: teacherId } = useParams<{ id: string }>();
  const { data: teacher, isLoading: teacherLoading } = useTeacherDetails(
    teacherId!
  );
  const { data: progress } = useTeacherDutyProgress(teacherId);
  const { data: groups, isLoading: groupsLoading } = useExamGroups();

  const [filterType, setFilterType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  if (teacherLoading) return <p className="text-gray-500">Loading...</p>;
  if (!teacher) return <p className="text-red-600">Teacher not found.</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-400">
        <Link
          to="/manage-duties"
          className="transition-colors hover:text-gray-700"
        >
          Manage Duties
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          to={`/manage-duties/${teacher._id}`}
          className="transition-colors hover:text-gray-700"
        >
          {teacher.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-700">Select Exam</span>
      </nav>

      <AssignDutyTeacherBanner teacher={teacher} progress={progress ?? null} />

      {progress?.reached ? (
        <TargetReachedNotice
          teacherName={teacher.name}
          role="invigilator"
          target={progress.target}
          assigned={progress.assigned}
        />
      ) : (
        <>
          {(groups || []).length > 0 && (
            <ExamFilters
              selectedType={filterType}
              selectedSemester={filterSemester}
              onTypeChange={setFilterType}
              onSemesterChange={setFilterSemester}
            />
          )}

          {groupsLoading ? (
            <p className="text-gray-500">Loading exam groups...</p>
          ) : (
            <ExamGroupSection
              exams={groups || []}
              selectedType={filterType}
              selectedSemester={filterSemester}
              getCardHref={(g) =>
                `/manage-duties/${teacher._id}/assign/exams/${g._id}`
              }
              emptyState={
                <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
                  <p className="text-sm text-gray-500">
                    No exams match the current filters.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Ask the exam admin to create schedules first.
                  </p>
                </div>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
