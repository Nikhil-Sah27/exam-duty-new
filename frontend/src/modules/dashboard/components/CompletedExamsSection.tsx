import { CheckCircle2 } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import ExamCardGridSection from "./ExamCardGridSection";

/**
 * "Completed Exams" section — shown only when there are no ongoing or upcoming
 * exams, so the dashboard still surfaces the exam history instead of looking
 * empty. Rendered with the shared exam-card style; count in the header badge.
 */
export default function CompletedExamsSection({
  exams,
}: {
  exams: ExamGroup[];
}) {
  return (
    <ExamCardGridSection
      id="completed-exams"
      title="Completed Exams"
      icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
      countBadge="bg-green-100 text-green-700"
      exams={exams}
      emptyText="No exams yet — create one from the Exams page."
    />
  );
}
