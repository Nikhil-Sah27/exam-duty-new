import ExamCard from "@/modules/shared/exams/components/ExamCard";
import { getExamGroupStatus } from "@/modules/shared/exams/utils/examStatusUtils";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";

/**
 * Dashboard wrapper around the shared <ExamCard>. Keeps the dashboard's link
 * target (`/exams/:id`) and status derivation in one place while delegating
 * all rendering to the canonical card — so dashboard exam cards look identical
 * to the Exams page and every role dashboard.
 */
export default function DashboardExamCard({ group }: { group: ExamGroup }) {
  return (
    <ExamCard
      group={group}
      status={getExamGroupStatus(group)}
      to={(g) => `/exams/${g._id}`}
      departments={group.departments}
    />
  );
}
