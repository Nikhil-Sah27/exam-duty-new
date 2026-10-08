import { Building2 } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Which college this session is in (MULTI_COLLEGE_PLAN.md) — a chip for the
 * dark top bars. Renders nothing for the superadmin, who belongs to none.
 */
export default function CollegeBadge() {
  const college = useAuthStore((s) => s.user?.college);
  if (!college) return null;
  return (
    <span
      title={college.name}
      className="hidden max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-200 md:inline-flex"
    >
      <Building2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{college.name}</span>
    </span>
  );
}
