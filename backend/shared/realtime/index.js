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
 * Per college (MULTI_COLLEGE_PLAN.md): each socket joins its college's room and
 * a write signals only the college it happened in, so one college's rush of
 * claims never makes another college's pages refetch.
 *
 * Optional by design: if socket.io isn't installed the server runs exactly as
 * before and pages just don't update on their own.
 */
const { currentScope } = require("../tenancy/context");

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
// Colleges with a pending signal; EVERYONE when a write couldn't name its college.
const EVERYONE = "*";
const pending = new Set();

const roomFor = (collegeId) => `college:${collegeId}`;

const flush = () => {
  clearTimeout(quietTimer);
  quietTimer = null;
  firstPendingAt = 0;
  const targets = [...pending];
  pending.clear();
  if (!io) return;
  if (targets.includes(EVERYONE)) {
    io.emit("duties:changed");
    return;
  }
  for (const collegeId of targets) io.to(roomFor(collegeId)).emit("duties:changed");
};

/** Tell a college's open pages that who-holds-which-duty may have changed. */
const notifyDutiesChanged = (collegeId) => {
  if (!io) return;
  pending.add(collegeId ? String(collegeId) : EVERYONE);
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
  schema.post(WRITE_HOOKS, function signal() {
    // The write's own scope; failing that the document / filter it touched.
    const scoped = currentScope()?.collegeId;
    const fromDoc = this && (this.college || (typeof this.getFilter === "function" && this.getFilter().college));
    notifyDutiesChanged(scoped || fromDoc || null);
  });
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
      const { decoded, college } = await authenticateToken(socket.handshake.auth?.token);
      socket.data.userId = decoded.id;
      if (college) socket.join(roomFor(college._id));
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  console.log(`[realtime] socket.io listening on ${SOCKET_PATH}`);
  return io;
};

module.exports = { attachRealtime, notifyDutiesChanged, signalDutyChangesFrom };
