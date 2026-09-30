/**
 * Keeps each teacher's calendar in step with their duties by emailing standard
 * calendar invites (see CALENDAR_PLAN.md).
 *
 * State-based, not event-based: duties change in more places than notifications
 * cover (DCS self-release, change-request swaps, exam edits and deletions), so
 * instead of attaching an invite to particular events we compare the teacher's
 * live duty units with what their calendar was last sent (`CalendarEvent`) and
 * queue only the difference. Running it twice sends nothing the second time.
 *
 * Invites go through the same outbox as notification emails, so they inherit
 * retries, the delivery audit and the "mail must never fail a request" rule.
 */
const crypto = require("crypto");
const CalendarEvent = require("./calendarEvent.model");
const { localToUtc } = require("./calendar.ics");
const mailService = require("../mail/mail.service");
const mailDispatcher = require("../mail/mail.dispatcher");
const transport = require("../mail/mail.transport");
const { buildRoomLabel, buildExamLabel } = require("../exam-cleanup/utils/examCleanupUtils");
const { formatLongDate, formatTime12h } = require("../../shared/utils/datetime");

// Lazy: duty.service imports the notification emitter, which imports this file.
const dutyService = () => require("../duty/duty.service");

const DEBOUNCE_MS = 5 * 1000;

const ROLE_LABELS = {
  invigilator: "Invigilator",
  rs: "RS (Room Superintendent)",
  dcs: "DCS (Deputy Chief Superintendent)",
};
const ROLE_SHORT = { invigilator: "Invigilator", rs: "RS", dcs: "DCS" };

const isEnabled = () =>
  String(process.env.CALENDAR_INVITES ?? "true") !== "false" && transport.isEnabled();

const appUrl = () => (process.env.APP_URL || "https://proctavo.com").replace(/\/$/, "");

const uidDomain = () => {
  try {
    return new URL(appUrl()).hostname;
  } catch {
    return "proctavo.com";
  }
};

// One calendar event per duty unit — see duty/duty.unit.js.
const { unitKey, locationFor } = require("../duty/duty.unit");

/** Everything an invite and its email need about one unit. */
const describeUnit = (teacherId, duties) => {
  const first = duties[0];
  const examGroup = first.examSchedule?.examGroup;
  const examLabel = buildExamLabel({ examGroup, exam: first.exam });
  const semester = examGroup?.semester ?? first.exam?.semester ?? null;
  const exam = semester != null ? `${examLabel} · Sem ${semester}` : examLabel;
  const date = first.examSchedule?.date || first.date;
  const startTime = first.examSchedule?.startTime || first.startTime;
  const endTime = first.examSchedule?.endTime || first.endTime;
  const location = locationFor(duties);
  const roomCount = duties.length;

  const summary = `Exam duty: ${ROLE_SHORT[first.role] || first.role} — ${exam}`;
  const description = [
    `Role: ${ROLE_LABELS[first.role] || first.role}`,
    `Exam: ${exam}`,
    `${roomCount > 1 ? "Rooms" : "Room"}: ${location || "—"}`,
    `Time: ${formatLongDate(date)}, ${formatTime12h(startTime)} – ${formatTime12h(endTime)}`,
    "",
    `Your duties are always current in Proctavo: ${appUrl()}`,
  ].join("\n");

  const key = unitKey(first);
  const start = localToUtc(date, startTime);
  const end = localToUtc(date, endTime);
  const fingerprint = crypto
    .createHash("sha1")
    .update(JSON.stringify([start.toISOString(), end.toISOString(), summary, location, description]))
    .digest("hex");

  return {
    dutyId: String(first._id),
    key,
    uid: `duty-${teacherId}-${key.replace("|", "-")}@${uidDomain()}`,
    start,
    end,
    summary,
    location,
    description,
    fingerprint,
    // Same keys the email details table already understands.
    display: {
      examLabel,
      semester,
      roleLabel: ROLE_SHORT[first.role] || first.role,
      roomCount: first.role === "invigilator" ? undefined : roomCount,
      date,
      startTime,
      endTime,
      roomLabel: location,
    },
  };
};

const queueInvite = (teacherId, method, row, unit) => {
  const cancel = method === "CANCEL";
  const updated = !cancel && row.sequence > 0;
  return mailService.enqueueCalendar({
    recipient: teacherId,
    type: cancel ? "calendar_cancel" : "calendar_request",
    title: cancel
      ? "Calendar: Exam Duty Cancelled"
      : updated
        ? "Calendar: Exam Duty Updated"
        : "Calendar: Exam Duty",
    message: cancel
      ? "This duty is no longer on your schedule. The attached calendar update removes it from your calendar."
      : updated
        ? "Your exam duty changed. The attached calendar invite updates the event in your calendar."
        : "Your exam duty is attached as a calendar invite — open it to add the duty to your calendar.",
    data: {
      ...unit.display,
      // Lets the dispatcher add a "Confirm I'll be there" button to invites.
      ...(cancel || !unit.dutyId ? {} : { refDutyId: unit.dutyId }),
      calendar: {
        method,
        uid: row.uid,
        sequence: row.sequence,
        start: unit.start,
        end: unit.end,
        summary: unit.summary,
        location: unit.location,
        description: unit.description,
      },
    },
  });
};

/** Call sites pass either an id or a populated user doc. */
const toId = (v) => (v ? String(v._id || v) : null);

/** Per-teacher serialization — a sweep and a fast-path sync must not race. */
const locks = new Map();
const withLock = (id, fn) => {
  const prev = locks.get(id) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(id, next);
  // Cleanup must swallow the rejection itself: a bare `.finally()` returns a
  // new promise that re-rejects, and an unhandled rejection exits the process.
  const cleanup = () => {
    if (locks.get(id) === next) locks.delete(id);
  };
  next.then(cleanup, cleanup);
  return next;
};

/**
 * Reconcile one teacher's calendar. Returns counts of what was queued.
 * Only future units are considered on both sides — an event whose duty has
 * already happened is left alone rather than "cancelled".
 */
const syncTeacher = (teacher) => {
  const teacherId = toId(teacher);
  return withLock(teacherId, async () => {
    const tally = { requested: 0, cancelled: 0 };
    if (!isEnabled() || !teacherId) return tally;
    const now = new Date();

    const duties = await dutyService().getAssignedDutiesForTeacher(teacherId);
    const groups = new Map();
    for (const d of duties) {
      const k = unitKey(d);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d);
    }
    const units = [...groups.values()]
      .map((ds) => describeUnit(teacherId, ds))
      .filter((u) => u.end > now);
    const wanted = new Map(units.map((u) => [u.key, u]));

    const rows = await CalendarEvent.find({ teacher: teacherId });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    for (const unit of units) {
      let row = byKey.get(unit.key);
      if (row && row.status === "active" && row.fingerprint === unit.fingerprint) continue;
      if (!row) {
        row = await CalendarEvent.create({
          teacher: teacherId,
          key: unit.key,
          uid: unit.uid,
          sequence: 0,
          fingerprint: unit.fingerprint,
          endsAt: unit.end,
          startsAt: unit.start,
          summary: unit.summary,
          location: unit.location,
        });
      } else {
        row.sequence += 1;
        row.fingerprint = unit.fingerprint;
        row.status = "active";
        row.endsAt = unit.end;
        row.startsAt = unit.start;
        row.summary = unit.summary;
        row.location = unit.location;
        await row.save();
      }
      await queueInvite(teacherId, "REQUEST", row, unit);
      tally.requested += 1;
    }

    for (const row of rows) {
      if (row.status !== "active" || wanted.has(row.key) || row.endsAt <= now) continue;
      row.sequence += 1;
      row.status = "cancelled";
      await row.save();
      const start = row.startsAt || row.endsAt;
      await queueInvite(teacherId, "CANCEL", row, {
        start,
        end: row.endsAt,
        summary: row.summary || "Exam duty",
        location: row.location || "",
        description: "This exam duty was cancelled or reassigned.",
        display: { date: start, roomLabel: row.location || undefined },
      });
      tally.cancelled += 1;
    }

    if (tally.requested + tally.cancelled > 0) mailDispatcher.kick();
    return tally;
  });
};

// ── Fast path: sync shortly after a duty-related notification ──────────────
// Debounced so the sync reads committed data — notifications are often emitted
// inside a transaction, and a rolled-back one leaves nothing to invite for.

const dirty = new Set();
let flushTimer = null;

const flush = async () => {
  flushTimer = null;
  const ids = [...dirty];
  dirty.clear();
  for (const id of ids) {
    try {
      await syncTeacher(id);
    } catch (err) {
      console.error(`[calendar] sync failed for ${id}:`, err.message);
    }
  }
};

const markDirty = (teacher) => {
  const teacherId = toId(teacher);
  if (!teacherId || !isEnabled()) return;
  dirty.add(teacherId);
  if (!flushTimer) flushTimer = setTimeout(flush, DEBOUNCE_MS);
};

// ── Safety net: reconcile everyone with upcoming duties ─────────────────────
// Also the launch backfill — the first run after deploy invites every teacher
// for the duties they already hold.

const runSweep = async () => {
  if (!isEnabled()) return { teachers: 0, requested: 0, cancelled: 0 };
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 1);
  since.setUTCHours(0, 0, 0, 0);

  const fromDuties = await dutyService().getTeacherIdsWithDutiesSince(since);
  const fromEvents = await CalendarEvent.distinct("teacher", {
    status: "active",
    endsAt: { $gt: new Date() },
  });
  const ids = [...new Set([...fromDuties, ...fromEvents].map(String))];

  const total = { teachers: ids.length, requested: 0, cancelled: 0 };
  for (const id of ids) {
    try {
      const t = await syncTeacher(id);
      total.requested += t.requested;
      total.cancelled += t.cancelled;
    } catch (err) {
      console.error(`[calendar] sweep failed for ${id}:`, err.message);
    }
  }
  if (total.requested + total.cancelled > 0) {
    console.log(
      `[calendar] sweep — ${total.teachers} teachers, ${total.requested} invites, ${total.cancelled} cancellations queued`
    );
  }
  return total;
};

module.exports = { syncTeacher, markDirty, runSweep, isEnabled, describeUnit, unitKey };
