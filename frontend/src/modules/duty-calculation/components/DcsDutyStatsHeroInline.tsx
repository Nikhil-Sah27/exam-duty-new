import { useMyDcsDutyProgress } from "../hooks/useDutyProgress";
import HeroDutyCircles from "./HeroDutyCircles";

/**
 * DCS (Deputy Chief Superintendent) dashboard duty-status widget for
 * `DashboardHero`'s right slot. Mirrors the invigilator/RS widgets exactly —
 * same glass circles — sourced from `useMyDcsDutyProgress` (HOD/Dean pool,
 * total DCS duties = Σ (courses × students × examTypes) / 300, split evenly).
 *
 * Shares the `duty-calculation` query root, so teacher / department / semester /
 * course changes auto-refresh it with no manual reload.
 */
export default function DcsDutyStatsHeroInline() {
  const { data, isLoading, error } = useMyDcsDutyProgress();

  return (
    <HeroDutyCircles
      data={data}
      isLoading={isLoading}
      error={error}
      ineligibleMessage="DCS duty target not applicable — only HOD/Dean carry DCS duties."
    />
  );
}
