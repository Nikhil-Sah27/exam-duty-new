import type { ExamGroupStatus } from "../types/exam.types";

const STATUS_META: Record<
  ExamGroupStatus,
  { label: string; dot: string; text: string; border: string }
> = {
  ongoing: {
    label: "Ongoing",
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-blue-500",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
};

/**
 * Top-level band heading for an exam status (Ongoing / Upcoming / Completed).
 * A small status-coloured dot marks the band; the accent colour reflects status.
 */
export default function ExamStatusHeader({
  status,
  count,
}: {
  status: ExamGroupStatus;
  count: number;
}) {
  const m = STATUS_META[status];
  return (
    <div className={`flex items-center justify-between border-b pb-3 ${m.border}`}>
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
        <h2 className={`text-lg font-bold ${m.text}`}>
          {m.label}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-xs font-semibold text-gray-600">
            {count}
          </span>
        </h2>
      </div>
    </div>
  );
}
