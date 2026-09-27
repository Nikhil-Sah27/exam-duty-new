import { Clock } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import ExamTimelineItem from "./ExamTimelineItem";

interface UpcomingExamTimelineProps {
  exams: ExamGroup[];
}

/** Front side of the flip card — the Upcoming Exams Timeline. */
export default function UpcomingExamTimeline({ exams }: UpcomingExamTimelineProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-center gap-2 pr-10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 ring-1 ring-blue-200 dark:bg-white/10 dark:ring-blue-400/30">
          <Clock className="h-4 w-4 text-blue-600" />
        </span>
        <h3 className="text-base font-bold text-slate-800">
          Upcoming Exams Timeline
        </h3>
      </header>

      <ul className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {exams.map((exam, i) => (
          <ExamTimelineItem
            key={exam._id}
            exam={exam}
            isLast={i === exams.length - 1}
            isNearest={i === 0}
          />
        ))}
      </ul>
    </div>
  );
}
