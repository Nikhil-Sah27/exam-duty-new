import { Users, Crown, GraduationCap, BookOpen, UserCheck } from "lucide-react";
import { UserProfile } from "../types";

interface TeacherStatsProps {
  users: UserProfile[];
}

/**
 * Teaching designations, shown as per-designation head-counts. The "Other"
 * designation (admin / non-teaching accounts) is intentionally omitted — it's
 * not a teaching cohort.
 */
const DESIGNATION_CARDS = [
  { label: "HOD/Dean", icon: Crown, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Professor", icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50" },
  {
    label: "Associate Professor",
    icon: BookOpen,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    label: "Assistant Professor",
    icon: UserCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
] as const;

export default function TeacherStats({ users }: TeacherStatsProps) {
  const stats = [
    {
      label: "Total Teachers",
      value: users.length,
      icon: Users,
      color: "text-gray-700",
      bg: "bg-gray-100",
    },
    ...DESIGNATION_CARDS.map((c) => ({
      ...c,
      value: users.filter((u) => u.designation === c.label).length,
    })),
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
              <Icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs leading-tight text-gray-400">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
