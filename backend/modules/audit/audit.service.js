const repository = require("./audit.repository");

/**
 * Write a single audit log entry. Optionally participates in an existing
 * Mongo transaction via `session` so the log is committed atomically with
 * whatever data change it describes — or rolled back if that change fails.
 *
 * `details` is `Mixed`, so callers can attach any action-specific metadata
 * (affectedTeachers, affectedRooms, releasedDutyIds, …). Keep it flat-ish so
 * Mongo can index/query it later if we ever want server-side filters.
 */
const log = async (
  { action, entity, entityId = null, performedBy, details = null, ipAddress = null },
  session,
) => {
  if (!action) throw new Error("audit.log: action is required");
  if (!entity) throw new Error("audit.log: entity is required");
  if (!performedBy) throw new Error("audit.log: performedBy is required");

  return repository.create(
    { action, entity, entityId, performedBy, details, ipAddress },
    session,
  );
};

/**
 * Best-effort variant for controller-level hooks: the data change has already
 * committed, so a failed audit write must never turn a successful request
 * into an error. Fire-and-forget — logs to console instead of throwing.
 */
const logSafe = (entry) => {
  Promise.resolve()
    .then(() => log(entry))
    .catch((err) => {
      console.error(`audit.logSafe(${entry?.action}) failed:`, err.message);
    });
};

/**
 * Actions the CS Audit Log intentionally hides: routine self-claims by
 * teachers. CS cares about who *assigned* or *approved* duties, not every
 * teacher picking up an open slot themselves — those would drown the log.
 * Excluded unconditionally so they never surface, filtered or not.
 */
const HIDDEN_ACTIONS = [
  "SELF_ASSIGN_DUTY",
  "SELF_ASSIGN_DUTY_GROUP",
  "CLAIM_DCS_GROUP",
];

/**
 * Paginated, filterable read used by the CS Audit Log screen.
 * Filters: action, entity, performedBy, from/to (createdAt range).
 */
const list = async ({ action, entity, performedBy, from, to, page = 1, limit = 25 } = {}) => {
  const filter = {};
  // `action` may be a single action or a comma-separated list (e.g. the "Duty
  // assigned by CS" filter matches both the single and group admin-assign
  // actions). Hidden self-claim actions are never selectable; with no action
  // filter, show everything except them.
  const requestedActions = action
    ? String(action)
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a && !HIDDEN_ACTIONS.includes(a))
    : [];
  if (requestedActions.length > 1) {
    filter.action = { $in: requestedActions };
  } else if (requestedActions.length === 1) {
    filter.action = requestedActions[0];
  } else {
    filter.action = { $nin: HIDDEN_ACTIONS };
  }
  if (entity) filter.entity = entity;
  if (performedBy) filter.performedBy = performedBy;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      // `to` is an inclusive calendar date — cover the whole day.
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const { items, total } = await repository.findPage(filter, {
    skip: (safePage - 1) * safeLimit,
    limit: safeLimit,
  });

  return {
    items,
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
};

const getById = async (id) => repository.findById(id);

module.exports = { log, logSafe, list, getById };
