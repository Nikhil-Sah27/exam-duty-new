import { useMyDutyProgress } from "../hooks/useDutyProgress";
import HeroDutyCircles from "./HeroDutyCircles";

/**
 * Invigilator dashboard duty-status widget for `DashboardHero`'s right slot.
 * Fed by `useMyDutyProgress`, which shares the `duty-calculation` query root so
 * it auto-invalidates on every mutation that changes the target formula inputs
 * (teachers, departments, semesters, courses, rooms, duties).
 *
 * Rendering lives in the shared `HeroDutyCircles` — see there for the visuals.
 */
export default function DutyStatsHeroInline() {
  const { data, isLoading, error } = useMyDutyProgress();

  return (
    <HeroDutyCircles
      data={data}
      isLoading={isLoading}
      error={error}
      ineligibleMessage="Duty target not applicable — only Assistant / Associate Professors carry invigilation duties."
    />
  );
}
