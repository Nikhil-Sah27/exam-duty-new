/**
 * Live updates over socket.io (REALTIME_PLAN.md §3).
 *
 * The server only ever sends a content-free `duties:changed` signal; each open
 * page reacts by refetching what it shows through the normal, authorized API.
 * No duty data or names travel over the socket, so it adds no second data path
 * to secure — "only CS sees who holds a duty" stays enforced where it is.
 *
 * Signals come from Mongoose hooks on Duty and DCSGroup, so every write path
 * (claims, CS assign/unassign, swaps, exam cleanup, scripts) is covered without
 * touching call sites. Bursts are coalesced: a 5-room group claim is one
 * signal, sent once the writes go quiet — i.e. after their transaction commits.
 *
 * Optional by design: if socket.io isn't installed the server runs exactly as
 * before and pages just don't update on their own.
 */

// Under the API prefix so it rides the existing proxies (Vite /api in dev,
// nginx /api in production) — no new public route.
const SOCKET_PATH = "/api/socket.io";
// Send once writes have been quiet this long…
const QUIET_MS = 300;
// …but at least this often during a sustained rush of claims.
const MAX_WAIT_MS = 2000;

let io = null;
let quietTimer = null;
let firstPendingAt = 0;

const flush = () => {
  clearTimeout(quietTimer);
  quietTimer = null;
  firstPendingAt = 0;
  if (io) io.emit("duties:changed");
};

/** Tell every open page that who-holds-which-duty may have changed. */
const notifyDutiesChanged = () => {
  if (!io) return;
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  clearTimeout(quietTimer);
  if (now - firstPendingAt >= MAX_WAIT_MS) {
    flush();
    return;
  }
  quietTimer = setTimeout(flush, QUIET_MS);
};

// Every Mongoose write a Duty / DCSGroup can go through (document, query and
// model middleware). `findByIdAndUpdate` is `findOneAndUpdate`.
const WRITE_HOOKS = [
  "save",
  "insertMany",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];

/** Register the hooks that make writes to this schema signal open pages. */
const signalDutyChangesFrom = (schema) => {
  schema.post(WRITE_HOOKS, () => notifyDutiesChanged());
};

/** Attach socket.io to the HTTP server. Returns null when it isn't installed. */
const attachRealtime = (httpServer) => {
  let Server;
  try {
    ({ Server } = require("socket.io"));
  } catch {
    console.warn("[realtime] socket.io is not installed — live updates are off (npm install in backend/)");
    return null;
  }
  const { corsOrigin } = require("../config/cors");
  const authenticateToken = require("../utils/authenticateToken");

  io = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: corsOrigin, credentials: true },
  });

  // Same rules as `protect`: a role-bound token for a user who still holds the role.
  io.use(async (socket, next) => {
    try {
      const { decoded } = await authenticateToken(socket.handshake.auth?.token);
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  console.log(`[realtime] socket.io listening on ${SOCKET_PATH}`);
  return io;
};

module.exports = { attachRealtime, notifyDutiesChanged, signalDutyChangesFrom };
