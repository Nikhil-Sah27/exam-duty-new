import { Check } from "lucide-react";
import type { ExamGroup, ExamGroupStatus } from "@/modules/exams/types";
import ExamOptionContent from "./ExamOptionContent";

/**
 * A single selectable exam row in the picker dropdown, styled as a soft rounded
 * card so rows read as distinct entries through spacing and shape rather than a
 * hard divider line. Renders the exam's status + badges via `ExamOptionContent`
 * and a check when it's the current selection.
 */
export default function ExamPickerOption({
  exam,
  status,
  selected,
  onSelect,
}: {
  exam: ExamGroup;
  status: ExamGroupStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-indigo-200 bg-indigo-50"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      <ExamOptionContent exam={exam} status={status} />
      {selected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
    </button>
  );
}
