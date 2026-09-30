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

module.exports = { MONTHS, formatDate, formatLongDate, formatTime12h };
