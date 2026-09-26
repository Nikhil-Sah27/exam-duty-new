import { CalendarDays } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import ExamCalendar from "./ExamCalendar";

interface UpcomingExamCalendarProps {
  exams: ExamGroup[];
}

/** Back side of the flip card — the Upcoming Exam Dates calendar. */
export default function UpcomingExamCalendar({ exams }: UpcomingExamCalendarProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="mb-3 flex items-center gap-2 pr-10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 ring-1 ring-blue-200">
          <CalendarDays className="h-4 w-4 text-blue-600" />
        </span>
        <h3 className="text-base font-bold text-slate-800">
          Upcoming Exam Dates
        </h3>
      </header>
      <div className="flex-1">
        <ExamCalendar exams={exams} />
      </div>
    </div>
  );
}
