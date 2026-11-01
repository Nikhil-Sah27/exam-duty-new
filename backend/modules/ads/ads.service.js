const AppError = require("../../shared/utils/AppError");
const { resolveFeatures } = require("../../shared/tenancy/features");
const adsRepository = require("./ads.repository");
const { computeAdLevel, NO_SHOW_DAYS, DAY_MS } = require("./adLevel.utils");
const { isBehind } = require("../duty-calculation/selectionShortfall.utils");
const dutyCalculationService = require("../duty-calculation/dutyCalculation.service");
const dutyService = require("../duty/duty.service");

// Lazy: college.service → user.service → … would otherwise load in a cycle.
const collegeService = () => require("../college/college.service");

// ── The master switch (superadmin) ──────────────────────────────────────────

const toSettings = (doc) => ({ adsEnabled: Boolean(doc?.adsEnabled), updatedAt: doc?.updatedAt || null });

const getPlatformSettings = async () => toSettings(await adsRepository.getSettings());

const setPlatformAdsEnabled = async (adsEnabled, actor) => {
  if (typeof adsEnabled !== "boolean") throw new AppError("adsEnabled must be true or false", 400);
  return toSettings(await adsRepository.setSettings({ adsEnabled, updatedBy: actor.id }));
};

/** Ads show in a college only when both its own switch and the master switch are on. */
const adsEnabledForCollege = async (college) => {
  if (!college || !resolveFeatures(college.features).ads) return false;
  return (await getPlatformSettings()).adsEnabled;
};

// ── A teacher's ad level ────────────────────────────────────────────────────

/** Keep the teacher's "behind" clock in step: started while behind, gone once caught up. */
const trackBehind = async (teacherId, entry) => {
  if (entry) return adsRepository.markBehind(teacherId, entry.remaining);
  await adsRepository.clearBehind(teacherId);
  return null;
};

/**
 * { level, reasons } for the signed-in user (adLevel.utils explains both). CS
 * never sees ads. Re-checks the teacher's own selection on every call, so
 * picking duties drops the extra ads at the next app refresh.
 */
const getStatus = async (user, now = new Date()) => {
  if (!user.college || user.activeRole === "cs") return computeAdLevel({ enabled: false, now });
  const college = await collegeService().getCollege(user.college);
  if (!(await adsEnabledForCollege(college))) return computeAdLevel({ enabled: false, now });

  const { open, short } = await dutyCalculationService.findSelectionShortfall({ now, teacherId: user.id });
  const entry = short.get(String(user.id));
  const nudge = await trackBehind(user.id, isBehind(entry, open) ? entry : null);
  const absence = await dutyService.getLatestAbsence(user.id, new Date(now.getTime() - NO_SHOW_DAYS * DAY_MS));

  return computeAdLevel({
    enabled: true,
    behind: nudge && { since: nudge.behindSince, remaining: nudge.remaining },
    noShow: absence && { date: absence.date, markedAt: absence.absentAt },
    now,
  });
};

/**
 * 6-hourly, inside one college's scope: start the clock for teachers who fell
 * behind without opening the app (so procrastinating still counts the days),
 * stop it for those who caught up. Returns how many are behind.
 */
const syncBehindForCollege = async (college) => {
  if (!(await adsEnabledForCollege(college))) return 0;
  const { open, short } = await dutyCalculationService.findSelectionShortfall();
  const behind = new Map();
  for (const [teacherId, entry] of short) {
    if (isBehind(entry, open)) behind.set(teacherId, entry.remaining);
  }
  await adsRepository.replaceBehind(behind);
  return behind.size;
};

module.exports = { getPlatformSettings, setPlatformAdsEnabled, getStatus, syncBehindForCollege };
