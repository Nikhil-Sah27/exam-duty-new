import type { UserRole } from "@/shared/lib/types";
import { GraduationCap, ClipboardCheck, Shield, Users, Building2 } from "lucide-react";

interface RoleMeta {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
}

// Vibrant card presentation for each dashboard role, matching the SEE-theme
// color palette used elsewhere in the app.
const ROLE_META: Record<UserRole, RoleMeta> = {
  superadmin: {
    icon: Building2,
    title: "Superadmin Console",
    description: "Manage colleges, their CS accounts and features.",
    gradient: "from-slate-600 to-slate-800",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
  },
  cs: {
    icon: Shield,
    title: "Controller Dashboard",
    description: "Manage exams, users, and system-wide settings.",
    gradient: "from-purple-500 to-indigo-600",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  dcs: {
    icon: Users,
    title: "DCS Dashboard",
    description: "Supervise DCS groups and approve change requests.",
    gradient: "from-blue-500 to-cyan-600",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  rs: {
    icon: GraduationCap,
    title: "RS Dashboard",
    description: "Manage grouped classroom duties as Room Superintendent.",
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  invigilator: {
    icon: ClipboardCheck,
    title: "Invigilator Dashboard",
    description: "Select and manage classroom invigilation duties.",
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
};

interface Props {
  role: UserRole;
  onContinue: () => void;
  isLoading?: boolean;
}

export default function RoleSelectionCard({ role, onContinue, isLoading }: Props) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className={`h-2 bg-gradient-to-r ${meta.gradient}`} />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${meta.iconBg}`}>
            <Icon className={`h-7 w-7 ${meta.iconColor}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{meta.title}</h3>
            <p className="text-sm text-slate-500">{meta.description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={isLoading}
          className={`w-full rounded-lg bg-gradient-to-r ${meta.gradient} px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isLoading ? "Loading…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
