import type { ExamGroupType } from "@/modules/shared/exams/types/exam.types";
import {
  getCountdownLabel,
  getExamAccent,
  type ExamAccent,
} from "../../utils/examPopupUtils";

interface ExamCountdownProps {
  /** Exam start date (ISO). Countdown is derived live from the current date. */
  startDate: string;
  examType: ExamGroupType;
  /** Optional accent override (e.g. orange for the nearest exam). */
  accent?: ExamAccent;
}

/** Soft pill showing the dynamic "Starts in N days" countdown. */
export default function ExamCountdown({
  startDate,
  examType,
  accent,
}: ExamCountdownProps) {
  const a = accent ?? getExamAccent(examType);
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${a.pillBg} ${a.pillText}`}
    >
      {getCountdownLabel(startDate)}
    </span>
  );
}
