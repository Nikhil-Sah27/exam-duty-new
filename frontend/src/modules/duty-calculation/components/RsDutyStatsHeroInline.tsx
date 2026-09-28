import { useMyRsDutyProgress } from "../hooks/useDutyProgress";
import HeroDutyCircles from "./HeroDutyCircles";

/**
 * RS (Room Superintendent) dashboard duty-status widget for `DashboardHero`'s
 * right slot. Mirrors the invigilator widget exactly — same glass circles —
 * but sourced from `useMyRsDutyProgress` (Professors + Associate Professors,
 * total RS duties = invigilator total / 5, Professor base + Associate 0.7x).
 *
 * Shares the `duty-calculation` query root, so teacher / department / semester /
 * course changes auto-refresh it with no manual reload.
 */
export default function RsDutyStatsHeroInline() {
  const { data, isLoading, error } = useMyRsDutyProgress();

  return (
    <HeroDutyCircles
      data={data}
      isLoading={isLoading}
      error={error}
      ineligibleMessage="RS duty target not applicable — only Professors / Associate Professors carry RS duties."
    />
  );
}
