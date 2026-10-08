import type { CollegeFeatures } from "@/shared/lib/types";
import { FEATURE_LIST } from "../types";

/** Compact on/off chips for a college's switches (Colleges table). */
export default function FeatureChips({ features }: { features: CollegeFeatures }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FEATURE_LIST.map((f) => (
        <span
          key={f.key}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            features[f.key] ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400 line-through"
          }`}
        >
          {f.key.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export function StatusChip({ status }: { status: "active" | "suspended" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status === "active" ? "Active" : "Suspended"}
    </span>
  );
}
