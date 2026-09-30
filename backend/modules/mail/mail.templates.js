/**
 * Email rendering for notifications.
 *
 * One layout for every type. The in-app `title`/`message` carry the wording
 * (so the two channels always agree); this file adds what an inbox needs and a
 * bell doesn't — a subject line, the duty details spelled out so the teacher
 * doesn't have to log in to know where to be, and a link back into the app.
 *
 * Deliberately table-based with inline styles: email clients (Outlook in
 * particular) don't do flexbox, grid, or <style> blocks reliably.
 */
const {
  formatLongDate,
  formatTime12h,
} = require("../../shared/utils/datetime");

const BRAND = "#4f46e5"; // indigo-600 — matches the app's accent gradient
const BRAND_DARK = "#6d28d9"; // violet-700
const INK = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const appUrl = () => (process.env.APP_URL || "https://proctavo.com").replace(/\/$/, "");

// Only CS receives request_submitted, so that one can deep-link safely. Every
// other type can reach a user holding any of four roles (whose route trees are
// role-prefixed: /rs/…, /dcs/…, /invigilator/…), and a multi-role user picks a
// role at login — so those land on the root and let the app route them.
const CTA = {
  request_submitted: { label: "Review the request", path: "/requests" },
};

const ctaFor = (type) => {
  const cta = CTA[type] || { label: "Open Proctavo", path: "/" };
  return { label: cta.label, url: `${appUrl()}${cta.path}` };
};

const SUBJECT_PREFIX = "Proctavo";

/**
 * Subject = the in-app title, plus the duty date when there is one. A teacher
 * scanning an inbox should be able to act without opening the mail.
 */
const buildSubject = ({ title, data = {} }) => {
  const base = `${SUBJECT_PREFIX}: ${title}`;
  if (data.date) return `${base} — ${formatLongDate(data.date)}`;
  return base;
};

// Types whose message body already spells the details out line by line. Adding
// the table under them prints the same four facts twice.
const SELF_DESCRIBING = new Set(["exam_deleted_duty_release"]);

/** Label/value pairs describing the duty, skipping anything absent. */
const detailRows = ({ type, data = {} }) => {
  if (SELF_DESCRIBING.has(type)) return [];

  // A multi-duty reminder's room and time describe only the FIRST duty of the
  // day. Listing them as bare "Time"/"Room" reads as the whole day's detail —
  // a teacher with three duties could take it as one room and miss the rest.
  if (type === "duty_reminder" && data.count > 1) {
    const rows = [];
    if (data.date) rows.push(["Date", formatLongDate(data.date)]);
    rows.push(["Duties", `${data.count} that day`]);
    const first = [formatTime12h(data.startTime), data.roomLabel || data.room]
      .filter(Boolean)
      .join(" · ");
    if (first) rows.push(["First duty", first]);
    return rows;
  }

  const rows = [];

  const exam =
    data.examLabel && data.semester != null
      ? `${data.examLabel} — Semester ${data.semester}`
      : data.examLabel || null;
  if (exam) rows.push(["Exam", exam]);

  if (data.roleLabel) {
    const rooms =
      data.roomCount != null
        ? ` (${data.roomCount} room${data.roomCount === 1 ? "" : "s"})`
        : "";
    rows.push(["Role", `${data.roleLabel}${rooms}`]);
  }

  if (data.date) rows.push(["Date", formatLongDate(data.date)]);

  if (data.startTime && data.endTime) {
    rows.push(["Time", `${formatTime12h(data.startTime)} – ${formatTime12h(data.endTime)}`]);
  }

  const room = data.roomLabel || data.room;
  if (room) rows.push([data.roomCount > 1 ? "Rooms" : "Room", room]);

  if (data.target != null) rows.push(["Target", String(data.target)]);

  return rows;
};

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const detailsTableHtml = (rows) => {
  if (rows.length === 0) return "";
  const cells = rows
    .map(
      ([label, value]) => `
            <tr>
              <td style="padding:8px 16px 8px 0;color:${MUTED};font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:8px 0;color:${INK};font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
            </tr>`
    )
    .join("");
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;border-collapse:collapse;">
          ${cells}
        </table>`;
};

/** The in-app message may contain newlines (exam_deleted_duty_release does). */
const messageHtml = (message) =>
  escapeHtml(message)
    .split("\n")
    .map((line) => (line.trim() === "" ? "<div style=\"height:10px;\"></div>" : `<div>${line}</div>`))
    .join("");

const renderHtml = ({ type, title, message, data, recipientName, cta }) => {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName.split(" ")[0])},` : "Hello,";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});background-color:${BRAND};padding:18px 24px;">
                <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.2px;">Proctavo</div>
                <div style="color:#e0e7ff;font-size:12px;margin-top:2px;">Exam Duty Management</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <div style="color:${MUTED};font-size:14px;">${greeting}</div>
                <h1 style="margin:10px 0 12px;color:${INK};font-size:19px;font-weight:700;">${escapeHtml(title)}</h1>
                <div style="color:${INK};font-size:15px;line-height:1.55;">${messageHtml(message)}</div>
                ${detailsTableHtml(detailRows({ type, data }))}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
                  <tr>
                    <td style="background:${BRAND};border-radius:8px;">
                      <a href="${cta.url}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta.label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid ${BORDER};background:#fafafa;">
                <div style="color:${MUTED};font-size:12px;line-height:1.5;">
                  Sent by Proctavo because you have an account on the exam duty system.
                  Your duty details are always current in the app.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const renderText = ({ type, title, message, data, recipientName, cta }) => {
  const lines = [];
  lines.push(recipientName ? `Hi ${recipientName.split(" ")[0]},` : "Hello,");
  lines.push("");
  lines.push(title);
  lines.push("");
  lines.push(message);
  const rows = detailRows({ type, data });
  if (rows.length > 0) {
    lines.push("");
    for (const [label, value] of rows) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  lines.push(`${cta.label}: ${cta.url}`);
  lines.push("");
  lines.push("— Proctavo · Exam Duty Management");
  return lines.join("\n");
};

/**
 * Render one notification into a sendable email.
 * @returns {{subject: string, html: string, text: string}}
 */
const renderEmail = ({ type, title, message, data = {}, recipientName = null }) => {
  const cta = ctaFor(type);
  return {
    subject: buildSubject({ title, data }),
    html: renderHtml({ type, title, message, data, recipientName, cta }),
    text: renderText({ type, title, message, data, recipientName, cta }),
  };
};

module.exports = { renderEmail, buildSubject, detailRows };
