import { Activity } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import ExamCardGridSection from "./ExamCardGridSection";

/**
 * "Ongoing Exams" section — exams currently in progress, rendered with the
 * shared exam-card style. Count is shown in the header badge.
 */
export default function OngoingExamsSection({ exams }: { exams: ExamGroup[] }) {
  return (
    <ExamCardGridSection
      id="ongoing-exams"
      title="Ongoing Exams"
      icon={<Activity className="h-5 w-5 text-emerald-600" />}
      countBadge="bg-emerald-100 text-emerald-700"
      exams={exams}
      emptyText="No exams are currently in progress."
    />
  );
}
