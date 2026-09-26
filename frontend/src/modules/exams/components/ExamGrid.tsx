import { ExamGroup } from "../types";
import ExamGroupSection from "@/modules/shared/exams/components/ExamGroupSection";

interface ExamGridProps {
  groups: ExamGroup[];
  /**
   * Active type filter (`""` = all, otherwise one of `IA1` | `IA2` | `IA3` | `SEE`).
   * Forwarded to the shared grouping section.
   */
  selectedType: string;
  selectedSemester?: string;
  onDelete: (group: ExamGroup) => void;
}

// CS Exams page grid. Delegates everything to the shared <ExamGroupSection>
// so this view stays in lockstep with all other dashboards (Invigilator, RS,
// DCS, etc.). Admin-only behaviour (delete button on each card, absolute
// `/exams/:id` links) is wired through props.
export default function ExamGrid({
  groups,
  selectedType,
  selectedSemester = "",
  onDelete,
}: ExamGridProps) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
        <p className="text-sm text-gray-500">No exam groups found</p>
      </div>
    );
  }

  return (
    <ExamGroupSection
      exams={groups}
      selectedType={selectedType}
      selectedSemester={selectedSemester}
      getCardHref={(g) => `/exams/${g._id}`}
      onDelete={onDelete}
    />
  );
}
