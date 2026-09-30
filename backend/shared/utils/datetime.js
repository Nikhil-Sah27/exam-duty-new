/**
 * Date/time formatters shared by the in-app notification templates and the
 * email templates, so the two channels can never word the same duty
 * differently.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatDate = (date) => new Date(date).toLocaleDateString();

const formatLongDate = (date) => {
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "14:30" → "2:30 PM". Passes through anything it can't parse. */
const formatTime12h = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string") return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
};

const appTimezone = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

/** Milliseconds `tz` is ahead of UTC at the instant `utcMs`. */
const tzOffsetMs = (utcMs, tz) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
};

/**
 * Duty dates are stored as the calendar day at 00:00 UTC and times as local
 * "HH:MM" strings in the institution's timezone. Combine them into the real
 * instant. Two passes so a DST boundary on that day still lands correctly.
 */
const localToUtc = (dateValue, hhmm, tz = appTimezone()) => {
  const d = new Date(dateValue);
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  const wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h || 0, m || 0);
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz);
  return new Date(utc);
};

module.exports = { MONTHS, formatDate, formatLongDate, formatTime12h, appTimezone, localToUtc };
