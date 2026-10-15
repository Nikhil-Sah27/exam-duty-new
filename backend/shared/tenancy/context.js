/**
 * Which college the current piece of work belongs to (MULTI_COLLEGE_PLAN.md §3.2).
 *
 * Every request, job and timer runs inside exactly one scope:
 *   - a college scope — `runAsCollege(college, fn)`: college-owned models read
 *     and write only that college's documents, minus exam types the college has
 *     switched off;
 *   - the platform scope — `runAsPlatform(fn)`: no filter at all. Only for work
 *     that is platform-wide by design (login lookups, outbox dispatchers,
 *     superadmin screens, migrations).
 *
 * There is no third option: a college-owned model touched with no scope throws
 * (see plugin.js), so a forgotten wrapper fails loudly instead of leaking.
 *
 * AsyncLocalStorage carries the scope through awaits, promise chains and timers
 * started inside it — so code that batches work from many requests into one
 * timer (debounces, coalescers) must record the college per item rather than
 * trust whichever scope the timer inherited.
 */
const { AsyncLocalStorage } = require("node:async_hooks");
const { hiddenExamTypes } = require("./features");

const storage = new AsyncLocalStorage();

const PLATFORM = Object.freeze({ platform: true, collegeId: null, hiddenExamTypes: [] });

const toId = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

// Mongoose queries and aggregates are lazy: they run when awaited, which would
// be after `storage.run` has returned — outside the scope. Start them inside.
const runIn = (scope, fn) =>
  storage.run(scope, () => {
    const result = fn();
    return result && typeof result.exec === "function" ? result.exec() : result;
  });

/**
 * Run `fn` as `college` — a College document (or `{ _id, features }`). The
 * college's feature switches decide which exam types stay visible.
 */
const runAsCollege = (college, fn) => {
  const collegeId = toId(college);
  if (!collegeId) throw new Error("[tenancy] runAsCollege needs a college");
  const scope = Object.freeze({
    platform: false,
    collegeId,
    hiddenExamTypes: hiddenExamTypes(college && college.features),
  });
  return runIn(scope, fn);
};

const runAsPlatform = (fn) => runIn(PLATFORM, fn);

// Maintenance scripts only (script.js): a whole script works on one college.
// The server never sets this, so it stays fail-closed.
let scriptScope;

/** The active scope, or undefined when nothing set one. */
const currentScope = () => storage.getStore() || scriptScope;

/** For backend/scripts: run everything outside an explicit scope as `college`. */
const setScriptCollege = (college) => {
  scriptScope = Object.freeze({
    platform: false,
    collegeId: toId(college),
    hiddenExamTypes: hiddenExamTypes(college && college.features),
  });
};

/** Express middleware: the rest of this request runs in the platform scope. */
const platformScope = (req, res, next) => runAsPlatform(next);

module.exports = { runAsCollege, runAsPlatform, currentScope, platformScope, setScriptCollege, toId };
