import { CheckCircle2, Hourglass, Target } from "lucide-react";

interface DutyStatsBarProps {
  /** Completed duty units across all of the teacher's roles. */
  completed: number;
  /** Remaining duty units to reach target (sum of max(0, target - completed) per role). */
  remaining: number;
  /** Total target duty units across all of the teacher's roles. */
  target: number;
}

export default function DutyStatsBar({
  completed,
  remaining,
  target,
}: DutyStatsBarProps) {
  const stats = [
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Remaining",
      value: remaining,
      icon: Hourglass,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Target",
      value: target,
      icon: Target,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center gap-3 px-6 py-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
            >
              <Icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
