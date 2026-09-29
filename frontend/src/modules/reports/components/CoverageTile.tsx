import type { LucideIcon } from "lucide-react";

export type CoverageAccent = "gray" | "indigo" | "emerald" | "amber";

const ACCENT: Record<CoverageAccent, string> = {
  gray: "bg-gray-100 text-gray-600",
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
};

export interface CoverageTileProps {
  label: string;
  value: string;
  hint?: string;
  /** When set, renders a "N vacant" / "Fully staffed" status line. */
  vacant?: number;
  icon?: LucideIcon;
  accent?: CoverageAccent;
}

/**
 * A single coverage stat (room slots, invigilators, RS, DCS). Presentation
 * only — the caller decides what the numbers mean (per-room vs per-group), so
 * this component never has to know the difference.
 */
export default function CoverageTile({
  label,
  value,
  hint,
  vacant,
  icon: Icon,
  accent = "gray",
}: CoverageTileProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {Icon && (
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENT[accent]}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      )}
      <div className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {label}
        </span>
        <p className="mt-0.5 text-2xl font-extrabold leading-tight text-gray-800">
          {value}
        </p>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
        {vacant !== undefined && (
          <p
            className={`text-[11px] ${
              vacant > 0 ? "font-semibold text-amber-600" : "text-emerald-600"
            }`}
          >
            {vacant > 0 ? `${vacant} vacant` : "Fully staffed"}
          </p>
        )}
      </div>
    </div>
  );
}
