/**
 * How many ads a teacher sees (ADS_PLAN.md, "Levels"). Pure: ads.service
 * gathers the facts, this decides, and the app maps each level to its slots.
 *
 *   0  off — ads switched off, or the user is acting as CS
 *   1  base — one banner on Home, for every teacher
 *   2  behind on picking duties for 1 day
 *   3  behind for 2–3 days
 *   4  behind for 4+ days, or marked absent within the last NO_SHOW_DAYS
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SHOW_DAYS = 14;
const LEVEL = { OFF: 0, BASE: 1, BEHIND: 2, BEHIND_DAYS: 3, TOP: 4 };

/** Behind since earlier today counts as day 1. */
const daysBehind = (since, now) => Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS) + 1;

const levelForDaysBehind = (days) => (days >= 4 ? LEVEL.TOP : days >= 2 ? LEVEL.BEHIND_DAYS : LEVEL.BEHIND);

/**
 * { level, reasons } for one teacher. `reasons` explain every step above the
 * base banner, so the app can say why and offer the fix:
 *   { code: "behind", remaining, since, days }
 *   { code: "no_show", date, until }
 *
 *   enabled: master switch and the college's switch are both on
 *   behind:  { since, remaining } while behind on picking duties, else null
 *   noShow:  { date, markedAt } of the latest recorded absence, else null
 */
const computeAdLevel = ({ enabled, behind = null, noShow = null, now = new Date() }) => {
  if (!enabled) return { level: LEVEL.OFF, reasons: [] };
  let level = LEVEL.BASE;
  const reasons = [];
  if (behind) {
    const days = daysBehind(behind.since, now);
    level = Math.max(level, levelForDaysBehind(days));
    reasons.push({ code: "behind", remaining: behind.remaining, since: new Date(behind.since), days });
  }
  if (noShow) {
    const until = new Date(new Date(noShow.markedAt).getTime() + NO_SHOW_DAYS * DAY_MS);
    if (until > now) {
      level = LEVEL.TOP;
      reasons.push({ code: "no_show", date: noShow.date, until });
    }
  }
  return { level, reasons };
};

module.exports = { LEVEL, NO_SHOW_DAYS, DAY_MS, computeAdLevel };
