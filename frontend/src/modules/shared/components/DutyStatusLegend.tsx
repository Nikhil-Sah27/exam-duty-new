import { Crown, Sparkles, CheckCircle2 } from "lucide-react";
import {
  getTeacherStatusLabel,
  getTeacherStatusPaint,
} from "../utils/assignmentStatusUtils";

/**
 * Top-of-page legend used by every teacher dashboard (Invigilator, RS, DCS)
 * on the Exams and Select Duty surfaces. Three distinct paints match the
 * status colours used by chips/cards/badges so the user has a single key to
 * read every screen.
 *
 * Stays out of the CS pages — the CS legend (`StatusLegend`) communicates the
 * "fully/partial/not assigned" model and remains untouched.
 */
const LEGEND_ITEMS = [
  {
    key: "AVAILABLE" as const,
    Icon: CheckCircle2,
    headline: "Available",
    detail: "Open for selection",
  },
  {
    key: "MINE" as const,
    Icon: Sparkles,
    headline: "My Duty",
    detail: "Selected or assigned to you",
  },
  {
    key: "OCCUPIED" as const,
    Icon: Crown,
    headline: "Occupied / Conflict",
    detail: "Cannot be selected",
  },
];

export default function DutyStatusLegend() {
  return (
    <section
      aria-label="Duty status legend"
      className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Duty Status
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          Teacher view
        </span>
      </header>

      <div className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-3">
        {LEGEND_ITEMS.map(({ key, Icon, headline, detail }) => {
          const paint = getTeacherStatusPaint(key);
          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-xl border bg-white/80 px-3 py-2 ring-1 ring-inset transition-shadow hover:shadow-sm ${paint.border} ring-white/40`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${paint.gradient}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className={`flex items-center gap-1.5 text-sm font-bold ${paint.text}`}>
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${paint.dot}`}
                    aria-hidden
                  />
                  {getTeacherStatusLabel(key) === headline ? headline : headline}
                </p>
                <p className="text-[11px] text-gray-500">{detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
