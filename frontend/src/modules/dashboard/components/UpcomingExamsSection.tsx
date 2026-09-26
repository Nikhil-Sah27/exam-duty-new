import { CalendarClock } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import ExamCardGridSection from "./ExamCardGridSection";

/**
 * "Upcoming Exams" section — exams that haven't started yet (completed exams
 * excluded), rendered with the shared exam-card style. Count in header badge.
 */
export default function UpcomingExamsSection({ exams }: { exams: ExamGroup[] }) {
  return (
    <ExamCardGridSection
      id="upcoming-exams"
      title="Upcoming Exams"
      icon={<CalendarClock className="h-5 w-5 text-indigo-600" />}
      countBadge="bg-indigo-100 text-indigo-700"
      exams={exams}
      emptyText="No upcoming exams scheduled."
    />
  );
}
