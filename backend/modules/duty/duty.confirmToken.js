/**
 * One-click "Confirm I'll be there" links in duty emails. The token names one
 * teacher and one duty, expires the day after the duty, and is HMAC-signed with
 * JWT_SECRET — it can confirm that duty and nothing else, so it needs no login.
 */
const crypto = require("crypto");

const secret = () => process.env.JWT_SECRET || "dev-secret";
const b64 = (buf) => Buffer.from(buf).toString("base64url");
const mac = (payload) => crypto.createHmac("sha256", secret()).update(`duty-confirm:${payload}`).digest("base64url");

const sign = ({ teacherId, dutyId, expiresAt }) => {
  const payload = b64(JSON.stringify({ t: String(teacherId), d: String(dutyId), e: expiresAt.getTime() }));
  return `${payload}.${mac(payload)}`;
};

/** @returns {{teacherId: string, dutyId: string} | null} */
const verify = (token) => {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = mac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const { t, d, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!t || !d || !e || Date.now() > e) return null;
    return { teacherId: t, dutyId: d };
  } catch {
    return null;
  }
};

module.exports = { sign, verify };
