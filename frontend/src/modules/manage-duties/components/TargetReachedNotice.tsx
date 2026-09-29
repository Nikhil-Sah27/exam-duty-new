import { CheckCircle2 } from "lucide-react";
import { getRoleLabel } from "@/shared/constants/roles";
import type { AssignableDutyRole } from "../config/assignDutyRoutes";

interface TargetReachedNoticeProps {
  teacherName: string;
  role: AssignableDutyRole;
  target: number;
  assigned: number;
}

/**
 * Shown in place of the assign UI when a teacher has already met their duty
 * target for a role. The CS can't assign any further duties of that role — the
 * backend enforces the same rule, so this is the friendly explanation rather
 * than the only guard.
 */
export default function TargetReachedNotice({
  teacherName,
  role,
  target,
  assigned,
}: TargetReachedNoticeProps) {
  const roleLabel = getRoleLabel(role);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-emerald-800">
          {teacherName} has completed their {roleLabel} duty target
        </h3>
        <p className="text-sm text-emerald-700">
          {assigned} of {target} {roleLabel} {target === 1 ? "duty" : "duties"}{" "}
          assigned — no further {roleLabel} duties can be assigned.
        </p>
      </div>
    </div>
  );
}
