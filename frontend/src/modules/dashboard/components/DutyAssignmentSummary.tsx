import type { RoomDutyFlags } from "@/modules/shared/exams/types/exam.types";

/**
 * Compact DCS / RS / Invigilator assignment summary for one classroom. The
 * project models exactly one of each required duty per room (the duty-status
 * feed exposes a boolean per role), so each shows `x / 1`. A vacant duty is
 * dotted red, an assigned one green — making remaining gaps obvious at a glance.
 */
export default function DutyAssignmentSummary({
  flags,
}: {
  flags: RoomDutyFlags;
}) {
  const duties: { label: string; assigned: boolean }[] = [
    { label: "DCS", assigned: flags.dcsAssigned },
    { label: "RS", assigned: flags.rsAssigned },
    { label: "INV", assigned: flags.invigilatorAssigned },
  ];

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {duties.map((d) => (
        <span key={d.label} className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              d.assigned ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="font-medium text-slate-600">{d.label}</span>
          <span
            className={`tabular-nums font-semibold ${
              d.assigned ? "text-green-600" : "text-red-600"
            }`}
          >
            {d.assigned ? 1 : 0}/1
          </span>
        </span>
      ))}
    </div>
  );
}
