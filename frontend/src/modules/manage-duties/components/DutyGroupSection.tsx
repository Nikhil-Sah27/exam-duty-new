import { Clock, CheckCircle2, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DutyGroupSectionProps {
  title: string;
  variant: "upcoming" | "completed";
  /** Number of groups in this section — drives the count badge + empty state. */
  count: number;
  emptyLabel?: string;
  children: ReactNode;
}

/**
 * The card shell around a set of grouped duty tiles (RS room-groups or DCS
 * groups) on the CS Manage Duties detail page. Matches the header/border/
 * empty-state styling of the flat `DutySection` table so the three renderings
 * (invigilator table, RS groups, DCS groups) feel like one page — the leaf
 * content just differs by role.
 */
export default function DutyGroupSection({
  title,
  variant,
  count,
  emptyLabel,
  children,
}: DutyGroupSectionProps) {
  const Icon: LucideIcon = variant === "upcoming" ? Clock : CheckCircle2;
  const iconColor =
    variant === "upcoming" ? "text-blue-600" : "text-green-600";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {count}
        </span>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Inbox className="mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm">{emptyLabel ?? `No ${title.toLowerCase()} found`}</p>
        </div>
      ) : (
        <div className="p-5">{children}</div>
      )}
    </div>
  );
}
