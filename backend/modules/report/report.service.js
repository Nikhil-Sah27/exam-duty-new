/**
 * CS reports assembled from other modules' services (never their repositories).
 */
const dutyService = require("../duty/duty.service");
const notificationService = require("../notification/notification.service");
const userService = require("../user/user.service");
const { calculateAllTeachersProgress } = require("../duty-calculation/dutyCalculation.service");
const { groupIntoUnits, idOf } = require("../duty/duty.unit");
const { localToUtc } = require("../../shared/utils/datetime");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 120; // window for "average time to confirm"
const NOT_RESPONDING_AFTER = 48 * HOUR; // unconfirmed longer than this → flagged

/**
 * Who is and isn't responding (REMINDERS_PLAN.md §D). One row per teacher with
 * a duty role: upcoming duty units, how many are confirmed, how long the oldest
 * unconfirmed one has waited, how fast they usually confirm, how many nudges
 * they've had, and selection progress against target.
 *
 * Counts are in duty UNITS — a 5-room RS group is one duty, one confirmation.
 */
const getResponsiveness = async () => {
  const now = new Date();
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY);

  const [{ teachers: progressRows }, duties, nudges, staleSelectNudges] = await Promise.all([
    calculateAllTeachersProgress(),
    dutyService.getDutiesForResponsiveness(since),
    notificationService.countNudgesByRecipient(since),
    // Asked to select more than 48h ago — long enough to have acted on it.
    notificationService.countSelectionNudgesBefore(since, new Date(now.getTime() - NOT_RESPONDING_AFTER)),
  ]);

  const rows = new Map();
  const rowFor = (id, seed = {}) => {
    if (!rows.has(id)) {
      rows.set(id, {
        teacherId: id,
        name: seed.name || "—",
        email: seed.email || null,
        department: seed.department || null,
        designation: seed.designation || null,
        roles: [],
        target: 0,
        selected: 0,
        upcoming: 0,
        confirmed: 0,
        awaiting: 0,
        oldestAwaitingSince: null,
        avgConfirmHours: null,
        nudges: nudges[id] || 0,
        lastActiveAt: null,
        notResponding: false,
        reasons: [],
      });
    }
    return rows.get(id);
  };

  for (const p of progressRows) {
    const r = rowFor(String(p.teacherId), p);
    if (!r.roles.includes(p.role)) r.roles.push(p.role);
    if (p.eligible) {
      r.target += p.target || 0;
      r.selected += p.assigned || 0;
    }
  }

  const confirmTimes = new Map();
  for (const list of groupIntoUnits(duties).values()) {
    const first = list[0];
    const id = idOf(first.teacher);
    if (!rows.has(id)) continue; // not in the teaching cohort (e.g. "Other")
    const r = rows.get(id);
    const start = localToUtc(first.examSchedule?.date || first.date, first.examSchedule?.startTime || first.startTime);
    const assignedAt = new Date(Math.min(...list.map((d) => new Date(d.createdAt).getTime())));
    const confirmedAt = list.every((d) => d.confirmedAt)
      ? new Date(Math.max(...list.map((d) => new Date(d.confirmedAt).getTime())))
      : null;

    // Only an actual response counts toward speed — not self-claims.
    if (confirmedAt && ["email", "app"].includes(first.confirmedVia)) {
      if (!confirmTimes.has(id)) confirmTimes.set(id, []);
      confirmTimes.get(id).push(confirmedAt - assignedAt);
    }

    if (first.status !== "assigned" || start <= now) continue;
    r.upcoming += 1;
    if (confirmedAt) r.confirmed += 1;
    else {
      r.awaiting += 1;
      if (!r.oldestAwaitingSince || assignedAt < r.oldestAwaitingSince) r.oldestAwaitingSince = assignedAt;
    }
  }

  const lastActive = await userService.getLastActiveMap([...rows.keys()]);
  for (const r of rows.values()) {
    const times = confirmTimes.get(r.teacherId);
    if (times?.length) {
      r.avgConfirmHours = Math.round((times.reduce((a, b) => a + b, 0) / times.length / HOUR) * 10) / 10;
    }
    r.lastActiveAt = lastActive[r.teacherId] || null;
    if (r.oldestAwaitingSince && now - r.oldestAwaitingSince > NOT_RESPONDING_AFTER) {
      r.reasons.push("unconfirmed duty over 48h");
    }
    if (r.target > 0 && r.selected < r.target && (staleSelectNudges[r.teacherId] || 0) > 0) {
      r.reasons.push("below target 48h after being asked to select");
    }
    r.notResponding = r.reasons.length > 0;
  }

  const list = [...rows.values()].sort(
    (a, b) =>
      Number(b.notResponding) - Number(a.notResponding) ||
      b.awaiting - a.awaiting ||
      a.name.localeCompare(b.name)
  );
  return {
    generatedAt: now,
    summary: {
      teachers: list.length,
      notResponding: list.filter((r) => r.notResponding).length,
      awaitingConfirmation: list.reduce((n, r) => n + r.awaiting, 0),
      belowTarget: list.filter((r) => r.target > 0 && r.selected < r.target).length,
    },
    teachers: list,
  };
};

module.exports = { getResponsiveness };
