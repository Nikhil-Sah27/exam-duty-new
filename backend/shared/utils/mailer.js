const nodemailer = require("nodemailer");

/**
 * Lazily-built mail transport. Configure via env:
 *   Gmail  — GMAIL_USER + GMAIL_APP_PASSWORD (a 16-char Google App Password)
 *   SMTP   — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  (+ optional SMTP_SECURE)
 *   From   — EMAIL_FROM (defaults to the Gmail/SMTP user)
 *
 * When nothing is configured the transport is null and callers fall back to
 * logging the message, so the OTP flow is fully testable in development without
 * real credentials.
 */
let cached;
function getTransport() {
  if (cached !== undefined) return cached;

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    cached = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  } else if (process.env.SMTP_HOST) {
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  } else {
    cached = null;
  }
  return cached;
}

const fromAddress = () =>
  process.env.EMAIL_FROM ||
  process.env.GMAIL_USER ||
  process.env.SMTP_USER ||
  "no-reply@examduty.com";

/** True when a real transport is configured (used to tailor API responses). */
const isMailConfigured = () => Boolean(getTransport());

/**
 * Send a password-reset OTP. If no transport is configured, the code is logged
 * to the server console instead of thrown, so local/dev flows keep working.
 */
async function sendOtpEmail(to, otp, name) {
  const subject = "Your Exam Duty password reset code";
  const text = `Hi ${name || "there"},\n\nYour password reset code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.\n\n— Proctavo · Exam Duty`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a8a;margin:0 0 8px">Password reset code</h2>
      <p style="color:#334155;margin:0 0 16px">Hi ${name || "there"}, use this code to reset your Exam Duty password. It expires in <b>10 minutes</b>.</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center">${otp}</div>
      <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>`;

  const transport = getTransport();
  if (!transport) {
    // Dev fallback — no SMTP configured.
    console.log(
      `[mailer] (no transport configured) OTP for ${to}: ${otp} — set GMAIL_USER/GMAIL_APP_PASSWORD or SMTP_* to send real email.`,
    );
    return { delivered: false };
  }

  await transport.sendMail({ from: fromAddress(), to, subject, text, html });
  return { delivered: true };
}

module.exports = { sendOtpEmail, isMailConfigured };
