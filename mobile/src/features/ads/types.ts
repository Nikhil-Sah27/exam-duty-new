/**
 * The teacher's ad level from GET /api/ads/status — decided by the backend
 * (backend/modules/ads/adLevel.utils.js); the app only maps it to ad slots.
 *
 *   0  off (ads switched off, or acting as CS)
 *   1  base banner on Home
 *   2  behind on picking duties for 1 day: + "why" strip, Select Duty banner
 *   3  behind 2–3 days: + Completed, Alerts and a second Home banner
 *   4  behind 4+ days or marked absent recently: + one full-screen ad a day
 */
export type AdLevel = 0 | 1 | 2 | 3 | 4;

export type AdReason =
  | { code: "behind"; remaining: number; days: number; since: string }
  | { code: "no_show"; date: string; until: string };

export interface AdStatus {
  level: AdLevel;
  reasons: AdReason[];
}
