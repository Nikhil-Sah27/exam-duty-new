/**
 * Verification of reminders, confirmation nudges and confirm links
 * (REMINDERS_PLAN.md) — run after changing reminder.jobs.js or confirmation.
 *
 *   MAIL_TRANSPORT=console MONGO_URI=<throwaway db> node scripts/verify-reminders.js
 *
 * Builds duties at chosen distances from "now" (backdating when they were
 * assigned), runs the real reminder tick, and checks exactly what it emitted.
 * Creates and removes its own users, duties and notifications.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../modules/auth/auth.model");
const Duty = require("../modules/duty/duty.model");
const ExamSchedule = require("../modules/exam/examSchedule.model");
const Notification = require("../modules/notification/notification.model");
const EmailOutbox = require("../modules/mail/emailOutbox.model");
const { runReminderTick, runSelectionNudgeSweep } = require("../modules/notification/reminder.jobs");
const dutyService = require("../modules/duty/duty.service");
const { appTimezone } = require("../shared/utils/datetime");

let pass = 0;
let fail = 0;
const check = (ok, label, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The local calendar date (as stored: 00:00 UTC) and "HH:MM" of an instant. */
const slotAt = (ms) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: appTimezone(),
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return {
    date: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`),
    time: `${parts.hour}:${parts.minute}`,
  };
};

const main = async () => {
  if (String(process.env.MAIL_TRANSPORT || "console").toLowerCase() !== "console") {
    console.error("Refusing to run: set MAIL_TRANSPORT=console so no real email is sent.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nconnected: ${process.env.MONGO_URI}\n`);

  const stamp = Date.now();
  const mkUser = (name, roles) =>
    User.create({
      name,
      email: `${name.replace(/\s+/g, "_").toLowerCase()}_${stamp}@example.com`,
      password: "hashed-not-used",
      phone: "9990000096",
      roles,
      designation: "Other",
    });
  const teacher = await mkUser("Reminder Teacher", ["invigilator", "rs"]);
  const cs = await mkUser("Reminder CS", ["cs"]);
  const examGroup = new mongoose.Types.ObjectId();
  const now = Date.now();

  /** A unit starting `inMs` from now, assigned `assignedAgoMs` ago. */
  const mkUnit = async ({ inMs, assignedAgoMs, role = "invigilator", rooms = ["101"], confirmed = false }) => {
    const start = slotAt(now + inMs);
    const end = slotAt(now + inMs + 90 * MIN);
    const schedule = await ExamSchedule.create({ examGroup, date: start.date, startTime: start.time, endTime: end.time });
    const ids = [];
    for (const room of rooms) {
      const d = await Duty.create({
        teacher: teacher._id,
        assignedBy: cs._id,
        role,
        room,
        examSchedule: schedule._id,
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        ...(confirmed ? { confirmedAt: new Date(), confirmedVia: "app" } : {}),
      });
      ids.push(d._id);
    }
    // Backdate the assignment — `timestamps` would otherwise pin it to now.
    await Duty.collection.updateMany({ _id: { $in: ids } }, { $set: { createdAt: new Date(now - assignedAgoMs) } });
    return { scheduleId: String(schedule._id), dutyIds: ids };
  };

  const notes = (filter) => Notification.find({ ...filter, createdAt: { $gte: new Date(now - MIN) } });
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyed = async (prefix) => (await Notification.find({ dedupeKey: new RegExp(`^${escape(prefix)}`) })).length;

  // ── scenarios ───────────────────────────────────────────────────────────
  const u3d = await mkUnit({ inMs: 2 * DAY + 23 * HOUR, assignedAgoMs: 5 * DAY, confirmed: true });
  const u1d = await mkUnit({ inMs: 20 * HOUR, assignedAgoMs: 5 * DAY });
  const u30 = await mkUnit({ inMs: 25 * MIN, assignedAgoMs: 5 * DAY, confirmed: true });
  const uGroup = await mkUnit({ inMs: 21 * HOUR, assignedAgoMs: 5 * DAY, role: "rs", rooms: ["201", "202", "203"], confirmed: true });
  const uFresh = await mkUnit({ inMs: 2 * DAY, assignedAgoMs: 1 * HOUR });

  const tally1 = await runReminderTick();
  const tally2 = await runReminderTick();
  const k = (u, stage) => `duty_reminder:${teacher._id}:${u.scheduleId}|${u === uGroup ? "rs" : "invigilator"}:${stage}`;

  console.log("1. reminder stages");
  check((await keyed(k(u3d, "3d"))) === 1, "3-day reminder for a duty ~3 days out");
  check((await keyed(k(u1d, "1d"))) === 1, "1-day reminder for a duty ~20h out");
  check((await keyed(k(u30, "30m"))) === 1, "30-minute reminder for a duty 25 min out");
  check((await keyed(k(u1d, "3d"))) === 0, "no stale 3-day reminder once the 1-day moment has passed");
  check((await keyed(k(uFresh, "3d"))) === 0, "no 3-day reminder for a duty assigned after that moment");

  console.log("\n2. groups & idempotency");
  check((await keyed(k(uGroup, "1d"))) === 1, "RS group of 3 rooms → exactly one reminder");
  check(
    tally2.reminders === 0 && tally2.nudges === 0 && tally2.csAlerts === 0,
    "second tick sends nothing",
    JSON.stringify(tally2)
  );
  check(tally1.reminders === 4, "first tick: 4 reminders in total", JSON.stringify(tally1));
  const groupNote = (await notes({ recipient: teacher._id, type: "duty_reminder", refId: uGroup.dutyIds[0] }))[0];
  check(/3 rooms: 201, 202, 203/.test(groupNote?.message || ""), "group reminder lists its rooms once", groupNote?.message);

  console.log("\n3. confirmation nudges & CS escalation");
  check((await keyed(`duty_confirm_nudge:${teacher._id}:${u1d.scheduleId}`)) === 1, "unconfirmed after 24h → teacher nudged");
  check((await keyed(`duty_confirm_nudge:${teacher._id}:${u3d.scheduleId}`)) === 0, "confirmed duty → no nudge");
  check((await keyed(`duty_confirm_nudge:${teacher._id}:${uFresh.scheduleId}`)) === 0, "just-assigned duty → no nudge yet");
  check(
    (await keyed(`duty_unconfirmed_alert:${cs._id}:${teacher._id}:${u1d.scheduleId}`)) === 1,
    "unconfirmed the day before → CS alerted"
  );
  const reminder1d = (await notes({ recipient: teacher._id, type: "duty_reminder", refId: u1d.dutyIds[0] }))[0];
  check(/confirm/i.test(reminder1d?.message || ""), "reminder for an unconfirmed duty asks to confirm", reminder1d?.message);

  console.log("\n4. confirm links");
  const links = await dutyService.confirmLinksForDuty(u1d.dutyIds[0]);
  check(Boolean(links?.confirmUrl), "unconfirmed duty gets a confirm link");
  const token = links.confirmUrl.split("/confirm/")[1];
  const first = await dutyService.confirmDutyByToken(token);
  check(first.confirmed === 1 && !first.alreadyConfirmed, "token confirms the duty");
  const again = await dutyService.confirmDutyByToken(token);
  check(again.alreadyConfirmed === true, "re-using the link reports already confirmed");
  check((await dutyService.confirmLinksForDuty(u1d.dutyIds[0])) === null, "no link once confirmed");
  let tampered = false;
  try {
    await dutyService.confirmDutyByToken(`${token.slice(0, -2)}xx`);
  } catch {
    tampered = true;
  }
  check(tampered, "a tampered token is rejected");

  const groupUnconfirmed = await mkUnit({ inMs: 4 * DAY, assignedAgoMs: HOUR, role: "rs", rooms: ["301", "302"] });
  const gl = await dutyService.confirmLinksForDuty(groupUnconfirmed.dutyIds[0]);
  const gr = await dutyService.confirmDutyByToken(gl.confirmUrl.split("/confirm/")[1]);
  check(gr.confirmed === 2, "confirming one room of a group confirms the whole group", `confirmed=${gr.confirmed}`);

  console.log("\n5. selection sweep");
  let swept = null;
  try {
    swept = await runSelectionNudgeSweep();
  } catch (err) {
    swept = err;
  }
  check(typeof swept === "number", "selection sweep runs cleanly", String(swept?.message || swept));

  // ── cleanup ─────────────────────────────────────────────────────────────
  const ids = [teacher._id, cs._id];
  await Notification.deleteMany({ recipient: { $in: ids } });
  await EmailOutbox.deleteMany({ recipient: { $in: ids } });
  await Duty.deleteMany({ teacher: teacher._id });
  await ExamSchedule.deleteMany({ examGroup });
  await User.deleteMany({ _id: { $in: ids } });

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`${"─".repeat(60)}\n`);
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
};

main().catch(async (err) => {
  console.error("\nverification crashed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
