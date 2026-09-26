/**
 * Pure presentation/data helpers for the Upcoming Exams popup. No React and no
 * data-fetching here — the popup components stay declarative and this stays
 * unit-testable. All exam data is passed in from the centralized exam hooks.
 */
import type {
  ExamGroup,
  ExamGroupType,
} from "@/modules/shared/exams/types/exam.types";

/**
 * Normalize an exam date (either a plain `YYYY-MM-DD` or a full ISO datetime)
 * to a local Date at midnight. Mirrors the semantics used by the app's
 * existing `getExamGroupStatus`, so countdowns line up with exam statuses.
 */
export function toLocalMidnight(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local `YYYY-MM-DD` key for a Date (used to index exam-day markers). */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Whole days from today until the exam start (>= 0 for an upcoming exam). */
export function getDaysUntilStart(
  startDate: string,
  now: Date = new Date(),
): number {
  const start = toLocalMidnight(startDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

/** Dynamic countdown label, e.g. "Starts in 5 days" / "Starts today". */
export function getCountdownLabel(
  startDate: string,
  now: Date = new Date(),
): string {
  const days = getDaysUntilStart(startDate, now);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts in 1 day";
  return `Starts in ${days} days`;
}

/** e.g. "15 Sep 2025". */
export function formatExamDate(dateStr: string): string {
  return toLocalMidnight(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** e.g. "15 Sep 2025 – 20 Sep 2025". */
export function formatExamRange(startDate: string, endDate: string): string {
  return `${formatExamDate(startDate)} – ${formatExamDate(endDate)}`;
}

/** e.g. "Sem 2 · CSE, ECE" (departments omitted when unknown). */
export function formatSemDepartments(
  semester: number,
  departments?: string[],
): string {
  const base = `Sem ${semester}`;
  return departments && departments.length > 0
    ? `${base} · ${departments.join(", ")}`
    : base;
}

/**
 * Visual accent per exam type — a dot color plus a soft countdown-pill tint.
 * Tuned to the reference timeline (IA1 blue, IA2 green, IA3 pink, SEE orange)
 * and kept local to the popup so it never touches shared exam styling.
 */
export interface ExamAccent {
  dot: string;
  pillBg: string;
  pillText: string;
}

const ACCENTS: Record<ExamGroupType, ExamAccent> = {
  IA1: { dot: "bg-blue-500", pillBg: "bg-blue-100/80", pillText: "text-blue-700" },
  IA2: {
    dot: "bg-emerald-500",
    pillBg: "bg-emerald-100/80",
    pillText: "text-emerald-700",
  },
  IA3: { dot: "bg-pink-500", pillBg: "bg-pink-100/80", pillText: "text-pink-700" },
  SEE: {
    dot: "bg-orange-500",
    pillBg: "bg-orange-100/80",
    pillText: "text-orange-700",
  },
};

export function getExamAccent(examType: ExamGroupType): ExamAccent {
  return (
    ACCENTS[examType] ?? {
      dot: "bg-slate-500",
      pillBg: "bg-slate-100/80",
      pillText: "text-slate-700",
    }
  );
}

/** Accent used to highlight the single nearest upcoming exam (orange). */
export const NEAREST_ACCENT: ExamAccent = {
  dot: "bg-orange-500",
  pillBg: "bg-orange-100/80",
  pillText: "text-orange-700",
};

/**
 * Expand each upcoming exam group across its [start, end] span (inclusive) and
 * index the resulting days by local date key → exam types present that day.
 * Uses only the centralized group start/end dates — no extra fetching.
 */
export function buildExamDayMap(
  exams: ExamGroup[],
): Map<string, ExamGroupType[]> {
  const map = new Map<string, ExamGroupType[]>();
  for (const g of exams) {
    const end = toLocalMidnight(g.endDate);
    const cur = toLocalMidnight(g.startDate);
    while (cur <= end) {
      const key = dateKey(cur);
      const arr = map.get(key) ?? [];
      if (!arr.includes(g.examType)) arr.push(g.examType);
      map.set(key, arr);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return map;
}

/**
 * Build the calendar cells for a month, padded with the trailing days of the
 * previous month and leading days of the next so every week row is complete.
 * Returns only as many rows as the month needs (5 or 6).
 */
export function buildMonthCells(year: number, month: number): Date[] {
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}
