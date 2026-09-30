/**
 * iCalendar (RFC 5545) rendering for duty invites. Pure — no I/O.
 *
 * Invites are sent as METHOD:REQUEST / METHOD:CANCEL with a stable UID and a
 * rising SEQUENCE. That pair is what lets a calendar client (Google, Outlook,
 * Apple) move or remove an event it accepted earlier, with no API access to
 * the teacher's calendar at all.
 */

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

/** 20261001T040000Z */
const icsDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escape a TEXT value (RFC 5545 §3.3.11). */
const escapeText = (v) =>
  String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
const fold = (line) => {
  const out = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch);
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + len > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out.join("\r\n ");
};

/**
 * @param {object} e
 * @param {"REQUEST"|"CANCEL"} e.method
 * @param {string} e.uid
 * @param {number} e.sequence
 * @param {Date} e.start
 * @param {Date} e.end
 * @param {string} e.summary
 * @param {string} [e.location]
 * @param {string} [e.description]
 * @param {{name: string, email: string}} e.organizer
 * @param {{name: string, email: string}} e.attendee
 * @param {Date} [e.stamp]
 */
const buildIcs = (e) => {
  const cancel = e.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Proctavo//Exam Duty//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence}`,
    `DTSTAMP:${icsDate(e.stamp || new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${escapeText(cancel ? `Cancelled: ${e.summary}` : e.summary)}`,
    e.location ? `LOCATION:${escapeText(e.location)}` : null,
    e.description ? `DESCRIPTION:${escapeText(e.description)}` : null,
    `ORGANIZER;CN=${escapeText(e.organizer.name)}:mailto:${e.organizer.email}`,
    // RSVP=FALSE: the invite is a notice, not a question — nobody should have
    // to accept an exam duty in their calendar app.
    `ATTENDEE;CN=${escapeText(e.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=${
      cancel ? "DECLINED" : "ACCEPTED"
    };RSVP=FALSE:mailto:${e.attendee.email}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(cancel
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Exam duty in 1 hour", "TRIGGER:-PT1H", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
};

/** "Proctavo <noreply@proctavo.com>" → { name, email }. */
const parseAddress = (value) => {
  const m = String(value || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  const email = String(value || "").trim();
  return { name: email, email };
};

module.exports = { buildIcs, localToUtc, parseAddress, appTimezone };
