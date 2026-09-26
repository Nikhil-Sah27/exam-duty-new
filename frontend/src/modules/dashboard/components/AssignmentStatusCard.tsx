import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export type StatCardTone =
  | "red"
  | "amber"
  | "emerald"
  | "indigo"
  | "violet"
  | "slate";

const TONES: Record<
  StatCardTone,
  { card: string; iconTile: string; value: string; chevron: string }
> = {
  red: {
    card: "border-rose-200 bg-gradient-to-br from-rose-50 to-white hover:border-rose-300",
    iconTile: "bg-rose-100 text-rose-600",
    value: "text-rose-600",
    chevron: "text-rose-300 group-hover:text-rose-500",
  },
  amber: {
    card: "border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300",
    iconTile: "bg-amber-100 text-amber-600",
    value: "text-amber-600",
    chevron: "text-amber-300 group-hover:text-amber-500",
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300",
    iconTile: "bg-emerald-100 text-emerald-600",
    value: "text-emerald-600",
    chevron: "text-emerald-300 group-hover:text-emerald-500",
  },
  indigo: {
    card: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300",
    iconTile: "bg-indigo-100 text-indigo-600",
    value: "text-indigo-600",
    chevron: "text-indigo-300 group-hover:text-indigo-500",
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-violet-50 to-white hover:border-violet-300",
    iconTile: "bg-violet-100 text-violet-600",
    value: "text-violet-600",
    chevron: "text-violet-300 group-hover:text-violet-500",
  },
  slate: {
    card: "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300",
    iconTile: "bg-slate-100 text-slate-600",
    value: "text-slate-700",
    chevron: "text-slate-300 group-hover:text-slate-500",
  },
};

export interface AssignmentStatusCardProps {
  tone: StatCardTone;
  icon: ReactNode;
  /** Bold heading, e.g. "Teachers Not Assigned". */
  label: string;
  /** The large highlighted figure. */
  value: number;
  /** Text before the value in the stat line, e.g. "across ". */
  valuePrefix?: string;
  /** Text after the value in the stat line, e.g. " classes". */
  valueSuffix?: string;
  /** When set, the whole card becomes a router Link and shows a chevron. */
  to?: string;
}

/**
 * Reusable dashboard stat card. Renders one figure with a label and a
 * "{prefix}{value}{suffix}" line, tinted by `tone`. Used for both the
 * assignment-status cards (Not Assigned / Partially Assigned) and the
 * Ongoing / Upcoming exam counts. Becomes clickable when `to` is provided.
 */
export default function AssignmentStatusCard({
  tone,
  icon,
  label,
  value,
  valuePrefix,
  valueSuffix,
  to,
}: AssignmentStatusCardProps) {
  const t = TONES[tone];

  const body = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.iconTile}`}
        >
          {icon}
        </span>
        {to && (
          <ChevronRight className={`h-5 w-5 transition-colors ${t.chevron}`} />
        )}
      </div>

      <p className="mt-4 text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-1 text-sm text-slate-500">
        {valuePrefix}
        <span className={`text-3xl font-extrabold align-middle ${t.value}`}>
          {value.toLocaleString()}
        </span>
        {valueSuffix}
      </p>
    </>
  );

  const className = `group flex flex-col rounded-2xl border p-5 shadow-sm transition-all ${t.card} ${
    to ? "hover:shadow-md" : ""
  }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
