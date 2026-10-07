/**
 * Push transport. Chosen by env:
 *
 *   PUSH_TRANSPORT   console | expo     (default: console)
 *   PUSH_ENABLED     "false" disables queueing entirely (default: enabled)
 *   EXPO_ACCESS_TOKEN  optional — only if "enhanced push security" is turned on
 *                      for the project at expo.dev
 *
 * `console` logs a one-line summary per message and sends nothing — the right
 * default locally and in CI, where test devices carry fake tokens. Production
 * sets PUSH_TRANSPORT=expo. Expo's push service relays to FCM (Android) and
 * APNs (iOS) using credentials uploaded to the Expo project, so the backend
 * itself holds no Firebase or Apple secrets.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo's per-request limit

const transportKind = () => (process.env.PUSH_TRANSPORT || "console").toLowerCase();
const isEnabled = () => String(process.env.PUSH_ENABLED ?? "true") !== "false";

/**
 * Send messages; returns one ticket per message, in order:
 * `{ status: "ok" }` or `{ status: "error", message, details: { error } }`.
 * Throws only when the whole request fails (network / 5xx) so the caller retries.
 */
const sendConsole = async (messages) =>
  messages.map((m) => {
    console.log(`[push:console] → ${m.to} | ${m.title}`);
    return { status: "ok", id: `console-${Date.now()}` };
  });

const sendExpo = async (messages) => {
  if (typeof fetch !== "function") throw new Error("global fetch unavailable (Node 18+ required)");
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const tickets = [];
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(chunk) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(body.data)) {
      const reason = body?.errors?.[0]?.message || `HTTP ${res.status}`;
      throw new Error(`Expo push request failed: ${reason}`);
    }
    tickets.push(...body.data);
  }
  return tickets;
};

const send = (messages) => (transportKind() === "expo" ? sendExpo(messages) : sendConsole(messages));

module.exports = { send, isEnabled, transportKind };
