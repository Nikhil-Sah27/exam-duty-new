import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTeacherDetails } from "../hooks";
import { useTeacherDutyProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import {
  useExamGroupDetails,
  useExamDutyStatus,
} from "@/modules/exams/hooks";
import type { ExamGroupStatus } from "@/modules/exams/types";
import ExamHeader from "@/modules/exams/components/ExamHeader";
import StatusLegend from "@/modules/exams/components/StatusLegend";
import Timetable from "@/modules/exams/components/Timetable";
import AssignDutyTeacherBanner from "./AssignDutyTeacherBanner";
import TargetReachedNotice from "./TargetReachedNotice";
import { AssignmentTeacherProvider } from "../context/AssignmentTeacherContext";

function getStatus(startDate: string, endDate: string): ExamGroupStatus {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "ongoing";
}

/**
 * Step 2 of the CS "assign duty" wizard — mirrors /exams/:id but strips the
 * CS-only edit chrome (Add Schedule / Add Room) and wraps the Timetable in
 * an AssignmentTeacherProvider so the deeply-nested DutyStatusModal can
 * surface the "Assign Duty to {teacher}" CTA on vacant invigilator slots.
 */
export default function AssignDutyExamDetailsPage() {
  const { id: teacherId, examId } = useParams<{
    id: string;
    examId: string;
  }>();

  const { data: teacher, isLoading: teacherLoading } = useTeacherDetails(
    teacherId!
  );
  const { data: progress } = useTeacherDutyProgress(teacherId);
  const { data: group, isLoading: groupLoading } = useExamGroupDetails(examId!);
  const { data: dutyStatusMap } = useExamDutyStatus(examId!);

  if (teacherLoading || groupLoading)
    return <p className="text-gray-500">Loading...</p>;
  if (!teacher) return <p className="text-red-600">Teacher not found.</p>;
  if (!group) return <p className="text-red-600">Exam group not found.</p>;

  const status = getStatus(group.startDate, group.endDate);

  return (
    <AssignmentTeacherProvider
      value={{ teacher, progress: progress ?? null }}
    >
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
          <Link
            to={`/manage-duties/${teacher._id}/assign`}
            className="transition-colors hover:text-gray-700"
          >
            Select Exam
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-700">
            {group.examType} — Semester {group.semester}
          </span>
        </nav>

        <AssignDutyTeacherBanner teacher={teacher} progress={progress ?? null} />

        <ExamHeader group={group} status={status} />

        {progress?.reached ? (
          <TargetReachedNotice
            teacherName={teacher.name}
            role="invigilator"
            target={progress.target}
            assigned={progress.assigned}
          />
        ) : (
          <>
            <StatusLegend />

            <Timetable
              schedules={group.schedules || []}
              dutyStatusMap={dutyStatusMap}
            />
          </>
        )}
      </div>
    </AssignmentTeacherProvider>
  );
}
