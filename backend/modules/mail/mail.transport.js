/**
 * Mail transport, built once from env.
 *
 *   MAIL_ENABLED    "false" disables enqueueing entirely (no outbox rows).
 *   MAIL_TRANSPORT  console | gmail | smtp     (default: console)
 *   MAIL_USER       account / SMTP username
 *   MAIL_PASS       Gmail App Password, or SMTP password
 *   MAIL_FROM       'Proctavo <proctavo@gmail.com>'  (defaults to MAIL_USER)
 *   MAIL_HOST/PORT/SECURE   smtp transport only
 *
 * `console` renders the mail and logs a one-line summary without sending. It is
 * the DEFAULT precisely so that local dev, the API test suite, and CI cannot
 * email anyone — the seeded accounts (@examduty.com) are not real addresses and
 * would bounce. Switching to real delivery is an env change, not a code change.
 */
const nodemailer = require("nodemailer");

let cached = null;

const transportKind = () => (process.env.MAIL_TRANSPORT || "console").toLowerCase();

const isEnabled = () => String(process.env.MAIL_ENABLED ?? "true") !== "false";

const fromAddress = () =>
  process.env.MAIL_FROM || process.env.MAIL_USER || "Proctavo <no-reply@proctavo.com>";

const buildTransport = () => {
  const kind = transportKind();

  if (kind === "gmail") {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.warn(
        "[mail] MAIL_TRANSPORT=gmail but MAIL_USER/MAIL_PASS are missing — falling back to console transport."
      );
      return buildConsoleTransport();
    }
    // Gmail requires an App Password (2FA on the account); the normal account
    // password will not authenticate over SMTP.
    return {
      kind: "gmail",
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      }),
    };
  }

  if (kind === "smtp") {
    const host = process.env.MAIL_HOST;
    if (!host) {
      console.warn(
        "[mail] MAIL_TRANSPORT=smtp but MAIL_HOST is missing — falling back to console transport."
      );
      return buildConsoleTransport();
    }
    const port = Number(process.env.MAIL_PORT || 587);
    return {
      kind: "smtp",
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: String(process.env.MAIL_SECURE ?? (port === 465)) === "true",
        auth:
          process.env.MAIL_USER && process.env.MAIL_PASS
            ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
            : undefined,
      }),
    };
  }

  return buildConsoleTransport();
};

const buildConsoleTransport = () => ({
  kind: "console",
  transporter: {
    sendMail: async ({ to, subject, icalEvent }) => {
      const invite = icalEvent ? ` [+ calendar ${icalEvent.method.toUpperCase()}]` : "";
      console.log(`[mail:console] → ${to} | ${subject}${invite}`);
      return { messageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    },
  },
});

const getTransport = () => {
  if (!cached) cached = buildTransport();
  return cached;
};

/** Send one email. Throws on failure so the dispatcher can retry. */
const send = async ({ to, subject, html, text, icalEvent }) => {
  const { transporter } = getTransport();
  const info = await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
    // A calendar invite rides as a text/calendar alternative, which is what
    // makes Gmail / Outlook show it as an event rather than an attachment.
    ...(icalEvent ? { icalEvent } : {}),
  });
  return { messageId: info?.messageId || null };
};

/** Reset the memoized transport — used by tests that flip env vars. */
const resetTransport = () => {
  cached = null;
};

module.exports = { send, isEnabled, transportKind, fromAddress, resetTransport };
