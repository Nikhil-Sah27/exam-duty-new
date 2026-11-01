import { useMemo, useState } from "react";
import type { Duty } from "@/modules/duties/types";
import type { AbsenceControls } from "../components/AbsentAction";
import { useMarkAbsent } from "./index";

/**
 * The no-show action for one teacher's duties (ADS_PLAN.md §1b). Marking is
 * confirmed first — it notifies the teacher — while undo applies at once.
 * A unit's duties are marked together, so any one of them answers "absent?".
 */
export function useAbsenceControls(duties: Duty[]) {
  const mark = useMarkAbsent();
  const [confirming, setConfirming] = useState<{ dutyId: string; what: string } | null>(null);

  const absentIds = useMemo(() => new Set(duties.filter((d) => d.absentAt).map((d) => d._id)), [duties]);

  const controls: AbsenceControls = {
    isAbsent: (dutyId) => absentIds.has(dutyId),
    toggle: (dutyId, absent, what) =>
      absent ? setConfirming({ dutyId, what }) : mark.mutate({ dutyId, absent: false }),
    pendingDutyId: mark.isPending ? (mark.variables?.dutyId ?? null) : null,
  };

  const confirm = () =>
    confirming && mark.mutate({ dutyId: confirming.dutyId, absent: true }, { onSettled: () => setConfirming(null) });

  return { controls, confirming, confirm, cancel: () => setConfirming(null), mark };
}
