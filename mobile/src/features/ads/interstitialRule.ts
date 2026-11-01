/**
 * When the level-4 full-screen ad may show (ADS_PLAN.md, "Interstitial
 * rules"). Pure, so the rule reads in one place.
 */

/** No full-screen ad from this long before a duty starts until it ends — the duty alarms ring in that window. */
export const DUTY_QUIET_MS = 3 * 60 * 60 * 1000;

/** The device's local calendar day, "2026-11-05" — the once-a-day cap's key. */
export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** At most once a day, and never close to (or during) one of the teacher's duties. */
export function mayShowInterstitial({
  lastShownDay,
  units,
  now,
}: {
  lastShownDay: string | null;
  units: { startsAt: string; endsAt: string }[];
  now: Date;
}): boolean {
  if (lastShownDay === localDay(now)) return false;
  const t = now.getTime();
  return !units.some((u) => new Date(u.startsAt).getTime() - DUTY_QUIET_MS <= t && t < new Date(u.endsAt).getTime());
}
