/**
 * Verification of calendar invites (CALENDAR_PLAN.md) — run after changing
 * anything in modules/calendar or the mail dispatcher.
 *
 *   MAIL_TRANSPORT=console node scripts/verify-calendar.js
 *
 * Point MONGO_URI at a throwaway database. It creates and removes its own test
 * teacher, duties and outbox rows. Force MAIL_TRANSPORT=console so nothing is
 * actually emailed.
 *
 * Covers:
 *   1. the .ics text itself (UTC conversion, method, UID, folding)
 *   2. a new duty → one invite; re-sync → nothing
 *   3. a changed duty → an update with the same UID and a higher SEQUENCE
 *   4. a cancelled duty → a CANCEL with the same UID
 *   5. an RS group → ONE event for the whole group
 *   6. a past duty is never invited or cancelled
 *   7. the emitter fast path invites within a few seconds
 *   8. the dispatcher sends a calendar row
 */
require("dotenv").config();
// Console transport normally disables automatic syncing (see isAutoEnabled);
// force it on so the fast-path check below exercises the real trigger.
process.env.CALENDAR_INVITES = "true";

const mongoose = require("mongoose");
const User = require("../modules/auth/auth.model");
const Duty = require("../modules/duty/duty.model");
const ExamSchedule = require("../modules/exam/examSchedule.model");
const EmailOutbox = require("../modules/mail/emailOutbox.model");
const Notification = require("../modules/notification/notification.model");
const CalendarEvent = require("../modules/calendar/calendarEvent.model");
const { buildIcs, localToUtc } = require("../modules/calendar/calendar.ics");
const { syncTeacher } = require("../modules/calendar/calendar.sync");
const { emit } = require("../modules/notification/notification.emitter");
const { drainOnce } = require("../modules/mail/mail.dispatcher");

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dayOffset = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const main = async () => {
  if (String(process.env.MAIL_TRANSPORT || "console").toLowerCase() !== "console") {
    console.error("Refusing to run: set MAIL_TRANSPORT=console so no real email is sent.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nconnected: ${process.env.MONGO_URI}\n`);

  // ── 1. .ics text ────────────────────────────────────────────────────────
  console.log("1. .ics rendering");
  const start = localToUtc(new Date("2026-10-01T00:00:00Z"), "09:30", "Asia/Kolkata");
  check(start.toISOString() === "2026-10-01T04:00:00.000Z", "09:30 IST → 04:00 UTC", start.toISOString());
  const ics = buildIcs({
    method: "REQUEST",
    uid: "duty-x@proctavo.com",
    sequence: 2,
    start,
    end: localToUtc(new Date("2026-10-01T00:00:00Z"), "11:00", "Asia/Kolkata"),
    summary: "Exam duty: Invigilator — IA1 · Sem 6",
    location: "Main Block — 101, 102; QA Academic Block — 004",
    description: "Role: Invigilator\nA long line that needs folding because it is well over seventy-five octets long, really.",
    organizer: { name: "Proctavo", email: "noreply@proctavo.com" },
    attendee: { name: "Test, Teacher", email: "t@example.com" },
  });
  check(ics.includes("METHOD:REQUEST\r\n"), "METHOD:REQUEST with CRLF");
  check(ics.includes("DTSTART:20261001T040000Z"), "DTSTART in UTC");
  check(ics.includes("SEQUENCE:2") && ics.includes("UID:duty-x@proctavo.com"), "UID + SEQUENCE");
  const unfolded = ics.replace(/\r\n /g, "");
  check(unfolded.includes("RSVP=FALSE:mailto:t@example.com"), "attendee, no RSVP asked");
  check(ics.includes("CN=Test\\, Teacher"), "commas escaped");
  check(
    ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75),
    "every line folded to ≤75 octets"
  );

  // ── setup ───────────────────────────────────────────────────────────────
  const stamp = Date.now();
  const teacher = await User.create({
    name: "Calendar Test Teacher",
    email: `calendar_${stamp}@example.com`,
    password: "hashed-not-used",
    phone: "9990000097",
    roles: ["invigilator", "rs"],
    designation: "Other",
  });
  const examGroup = new mongoose.Types.ObjectId();
  const date = dayOffset(20);
  const schedule = await ExamSchedule.create({ examGroup, date, startTime: "09:30", endTime: "11:00" });
  const rsSchedule = await ExamSchedule.create({ examGroup, date, startTime: "14:00", endTime: "15:30" });
  const base = { teacher: teacher._id, assignedBy: teacher._id, date, status: "assigned" };

  const calendarRows = () =>
    EmailOutbox.find({ recipient: teacher._id, type: /^calendar_/ }).sort({ createdAt: 1 });

  // ── 2. new duty ─────────────────────────────────────────────────────────
  console.log("\n2. new duty → one invite");
  const inv = await Duty.create({
    ...base,
    role: "invigilator",
    room: "101",
    examSchedule: schedule._id,
    startTime: "09:30",
    endTime: "11:00",
  });
  let t = await syncTeacher(teacher._id);
  let rows = await calendarRows();
  check(t.requested === 1 && rows.length === 1, "one calendar_request queued", `requested=${t.requested} rows=${rows.length}`);
  const uid = rows[0]?.data?.calendar?.uid;
  check(rows[0]?.data?.calendar?.sequence === 0, "SEQUENCE 0");
  t = await syncTeacher(teacher._id);
  check(t.requested === 0 && t.cancelled === 0, "re-sync queues nothing");

  // ── 3. changed duty ─────────────────────────────────────────────────────
  console.log("\n3. changed time → update");
  await ExamSchedule.updateOne({ _id: schedule._id }, { startTime: "10:00" });
  t = await syncTeacher(teacher._id);
  rows = await calendarRows();
  const upd = rows[rows.length - 1];
  check(t.requested === 1, "one update queued");
  check(upd?.data?.calendar?.uid === uid && upd?.data?.calendar?.sequence === 1, "same UID, SEQUENCE 1");
  check(new Date(upd?.data?.calendar?.start).toISOString().endsWith("T04:30:00.000Z"), "new start time (10:00 IST)");

  // ── 4. cancelled duty ───────────────────────────────────────────────────
  console.log("\n4. cancelled duty → CANCEL");
  await Duty.updateOne({ _id: inv._id }, { status: "cancelled" });
  t = await syncTeacher(teacher._id);
  rows = await calendarRows();
  const can = rows[rows.length - 1];
  check(t.cancelled === 1 && can?.type === "calendar_cancel", "calendar_cancel queued");
  check(can?.data?.calendar?.uid === uid && can?.data?.calendar?.sequence === 2, "same UID, SEQUENCE 2");
  t = await syncTeacher(teacher._id);
  check(t.requested === 0 && t.cancelled === 0, "re-sync after cancel queues nothing");

  // ── 5. RS group ─────────────────────────────────────────────────────────
  console.log("\n5. RS group of 3 rooms → one event");
  for (const room of ["103", "101", "102"]) {
    await Duty.create({ ...base, role: "rs", room, examSchedule: rsSchedule._id, startTime: "14:00", endTime: "15:30" });
  }
  const before = (await calendarRows()).length;
  t = await syncTeacher(teacher._id);
  rows = await calendarRows();
  check(t.requested === 1 && rows.length === before + 1, "exactly one invite for the group", `requested=${t.requested}`);
  const grp = rows[rows.length - 1]?.data;
  check(grp?.roomCount === 3, "roomCount 3", grp?.roomCount);
  check(/101.*102.*103/.test(grp?.calendar?.location || ""), "location lists every room, in order", grp?.calendar?.location);

  // ── 6. past duty ────────────────────────────────────────────────────────
  console.log("\n6. past duty is left alone");
  const pastSchedule = await ExamSchedule.create({ examGroup, date: dayOffset(-3), startTime: "09:30", endTime: "11:00" });
  await Duty.create({
    ...base,
    date: dayOffset(-3),
    role: "invigilator",
    room: "301",
    examSchedule: pastSchedule._id,
    startTime: "09:30",
    endTime: "11:00",
  });
  t = await syncTeacher(teacher._id);
  check(t.requested === 0 && t.cancelled === 0, "no invite for a duty that already happened");

  // ── 7. fast path through the emitter ────────────────────────────────────
  console.log("\n7. emitter fast path");
  const fastSchedule = await ExamSchedule.create({ examGroup, date: dayOffset(21), startTime: "09:30", endTime: "11:00" });
  await Duty.create({
    ...base,
    date: dayOffset(21),
    role: "invigilator",
    room: "201",
    examSchedule: fastSchedule._id,
    startTime: "09:30",
    endTime: "11:00",
  });
  const beforeFast = (await calendarRows()).length;
  await emit("duty_assigned", {
    recipient: teacher._id,
    data: { room: "201", date: dayOffset(21), startTime: "09:30", endTime: "11:00" },
  });
  await sleep(7000);
  check((await calendarRows()).length === beforeFast + 1, "invite queued within ~5s of the notification");

  // ── 8. dispatcher sends it ──────────────────────────────────────────────
  console.log("\n8. dispatcher");
  await drainOnce();
  await drainOnce();
  const pending = await EmailOutbox.countDocuments({ recipient: teacher._id, type: /^calendar_/, status: { $ne: "sent" } });
  check(pending === 0, "every calendar row sent", `${pending} not sent`);

  // ── cleanup ─────────────────────────────────────────────────────────────
  await EmailOutbox.deleteMany({ recipient: teacher._id });
  await Notification.deleteMany({ recipient: teacher._id });
  await CalendarEvent.deleteMany({ teacher: teacher._id });
  await Duty.deleteMany({ teacher: teacher._id });
  await ExamSchedule.deleteMany({ examGroup });
  await User.deleteOne({ _id: teacher._id });

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
