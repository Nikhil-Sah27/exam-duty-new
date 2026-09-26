import { useMemo, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import {
  buildExamDayMap,
  buildMonthCells,
  dateKey,
  getExamAccent,
} from "../../utils/examPopupUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ExamCalendarProps {
  exams: ExamGroup[];
}

/**
 * Month calendar with prev/next navigation. Exam days (from the real group
 * start/end spans) are marked with type-colored dots; today is highlighted.
 * This calendar is local to the popup and does not touch any global calendar.
 */
export default function ExamCalendar({ exams }: ExamCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [view, setView] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const examDays = useMemo(() => buildExamDayMap(exams), [exams]);
  const year = view.getFullYear();
  const month = view.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const todayKey = dateKey(today);
  const monthLabel = view.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Month navigation must not bubble up and flip the card.
  const navigate = (delta: number) => (e: MouseEvent) => {
    e.stopPropagation();
    setView(new Date(year, month + delta, 1));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={navigate(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-slate-800">{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={navigate(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {d}
          </span>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid flex-1 grid-cols-7 gap-y-0.5">
        {cells.map((cell) => {
          const inMonth = cell.getMonth() === month;
          const key = dateKey(cell);
          const isToday = key === todayKey;
          const types = inMonth ? examDays.get(key) : undefined;
          return (
            <div
              key={key}
              className="flex flex-col items-center justify-start pt-1"
            >
              <span
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-blue-100 font-bold text-blue-700 ring-1 ring-blue-300"
                    : inMonth
                      ? "text-slate-700"
                      : "text-slate-300",
                ].join(" ")}
              >
                {cell.getDate()}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {types?.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className={`h-1.5 w-1.5 rounded-full ${getExamAccent(t).dot}`}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
