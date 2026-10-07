import { CalendarClock, CheckCircle2 } from "lucide-react";
import DashboardDutyCard from "./DashboardDutyCard";
import type { DashboardDutyItem } from "../types";

interface DashboardDutySectionProps {
  title: string;
  tone: "upcoming" | "completed";
  items: readonly DashboardDutyItem[];
  emptyTitle: string;
  emptyHint?: string;
  /** Optional cap — extra items aren't rendered. */
  limit?: number;
  /** Optional "View all" link target shown in the section header. */
  viewAllHref?: string;
}

/**
 * Section wrapper used on every operational dashboard. Header carries a tone
 * (upcoming/completed) and the role-card grid lives underneath. Cards are
 * variant-styled inside so each item retains its role colors but completed
 * items also pick up a muted treatment.
 */
export default function DashboardDutySection({
  title,
  tone,
  items,
  emptyTitle,
  emptyHint,
  limit,
  viewAllHref,
}: DashboardDutySectionProps) {
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;
  const more = typeof limit === "number" ? Math.max(0, items.length - shown.length) : 0;
  const Icon = tone === "upcoming" ? CalendarClock : CheckCircle2;
  const accent =
    tone === "upcoming"
      ? "text-blue-600"
      : "text-gray-500";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-xl bg-white p-1.5 ring-1 ring-gray-200 ${accent}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            <p className="text-[11px] text-gray-500">
              {items.length} item{items.length === 1 ? "" : "s"}
              {more > 0 ? ` · showing first ${shown.length}` : ""}
            </p>
          </div>
          {tone === "upcoming" && (
            <span
              className="ml-1.5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-2 text-xs font-bold text-white shadow-sm shadow-indigo-900/30 ring-1 ring-white/20"
              title={`${items.length} upcoming dut${items.length === 1 ? "y" : "ies"}`}
            >
              {items.length}
            </span>
          )}
        </div>
        {viewAllHref && items.length > 0 && (
          <a
            href={viewAllHref}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            View all →
          </a>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/40 py-10 text-center">
          <Icon className={`h-8 w-8 ${accent}`} />
          <p className="text-sm font-medium text-gray-600">{emptyTitle}</p>
          {emptyHint && <p className="text-xs text-gray-400">{emptyHint}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <DashboardDutyCard key={item.id} item={item} variant={tone} />
          ))}
        </div>
      )}
    </section>
  );
}
