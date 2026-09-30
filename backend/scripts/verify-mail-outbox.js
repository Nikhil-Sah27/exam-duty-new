/**
 * Verification of the mail outbox — run after changing anything in modules/mail
 * or the notification emitter.
 *
 *   node scripts/verify-mail-outbox.js
 *
 * REQUIRES A REPLICA SET. `withOptionalTransaction` silently falls back to a
 * sessionless run on standalone MongoDB, so the rollback check below proves
 * nothing there. Start Mongo as a single-node replica set first:
 *
 *   docker run -d --name proctavo-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
 *   docker exec proctavo-mongo mongosh --quiet --eval 'rs.initiate()'
 *
 * It creates and removes its own test user and rows, and leaves nothing behind.
 *
 * Covers the two properties only a real replica set can demonstrate:
 *   1. emit() inside a transaction queues the email in that transaction.
 *   2. A rollback takes the queued email with it — no email about a duty that
 *      was never created.
 * Plus the ordinary path, and the "recipient has no address" skip.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { emit } = require("../modules/notification/notification.emitter");
const { drainOnce } = require("../modules/mail/mail.dispatcher");
const EmailOutbox = require("../modules/mail/emailOutbox.model");
const Notification = require("../modules/notification/notification.model");
const User = require("../modules/auth/auth.model");
const { withOptionalTransaction } = require("../shared/utils/withOptionalTransaction");

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

const DUTY_DATA = {
  room: "Academic Block — 004",
  date: new Date("2026-11-20"),
  startTime: "09:00",
  endTime: "12:00",
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nconnected: ${process.env.MONGO_URI}`);
  console.log(`transport: ${process.env.MAIL_TRANSPORT}\n`);

  const stamp = Date.now();
  const teacher = await User.create({
    name: "Outbox Test Teacher",
    email: `outbox_${stamp}@example.com`,
    password: "hashed-not-used",
    phone: "9990000099",
    roles: ["invigilator"],
    designation: "Other",
  });
  const noAddress = await User.collection.insertOne({
    name: "No Address Teacher",
    email: null,
    password: "x",
    phone: "9990000098",
    roles: ["invigilator"],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ── 1. Ordinary (non-transactional) emit ────────────────────────────────
  console.log("1. emit() outside a transaction");
  await emit("duty_assigned", {
    recipient: teacher._id,
    data: DUTY_DATA,
  });
  let rows = await EmailOutbox.find({ recipient: teacher._id });
  check(rows.length === 1, "one outbox row queued", `got ${rows.length}`);
  check(rows[0]?.status === "pending", "row starts pending", rows[0]?.status);
  check(
    rows[0]?.title === "New Duty Assigned",
    "row carries the rendered in-app title",
    rows[0]?.title
  );
  check(
    rows[0]?.data?.room === DUTY_DATA.room,
    "row carries the template payload for the email details block"
  );

  // ── 2. Dispatcher drains it ─────────────────────────────────────────────
  console.log("\n2. dispatcher drain");
  const tally = await drainOnce();
  check(tally.sent === 1, "dispatcher reports 1 sent", JSON.stringify(tally));
  rows = await EmailOutbox.find({ recipient: teacher._id });
  check(rows[0]?.status === "sent", "row marked sent", rows[0]?.status);
  check(Boolean(rows[0]?.messageId), "messageId recorded");
  check(Boolean(rows[0]?.sentAt), "sentAt recorded");

  // ── 3. Rollback safety — the whole reason for the outbox ────────────────
  console.log("\n3. rollback safety (emit inside a transaction that aborts)");
  const beforeN = await Notification.countDocuments({ recipient: teacher._id });
  const beforeO = await EmailOutbox.countDocuments({ recipient: teacher._id });
  let threw = false;
  try {
    await withOptionalTransaction(async (session) => {
      await emit("duty_cancelled", {
        recipient: teacher._id,
        data: { room: DUTY_DATA.room, date: DUTY_DATA.date },
        session,
      });
      throw new Error("simulated failure after emit");
    });
  } catch (err) {
    threw = err.message === "simulated failure after emit";
  }
  check(threw, "transaction aborted as intended");
  const afterN = await Notification.countDocuments({ recipient: teacher._id });
  const afterO = await EmailOutbox.countDocuments({ recipient: teacher._id });
  check(afterN === beforeN, "no notification survived the rollback", `${beforeN} → ${afterN}`);
  check(
    afterO === beforeO,
    "NO EMAIL survived the rollback (the core guarantee)",
    `${beforeO} → ${afterO}`
  );

  // ── 4. Committed transaction does queue ─────────────────────────────────
  console.log("\n4. committed transaction");
  await withOptionalTransaction(async (session) => {
    await emit("duty_cancelled", {
      recipient: teacher._id,
      data: { room: DUTY_DATA.room, date: DUTY_DATA.date },
      session,
    });
  });
  const committed = await EmailOutbox.countDocuments({
    recipient: teacher._id,
    type: "duty_cancelled",
  });
  check(committed === 1, "committed emit queued its email", `got ${committed}`);
  const t2 = await drainOnce();
  check(t2.sent === 1, "and the dispatcher sent it", JSON.stringify(t2));

  // ── 5. Policy: in-app-only type queues nothing ──────────────────────────
  console.log("\n5. policy — target_reached is in-app only");
  await emit("target_reached", { recipient: teacher._id, data: { target: 8 } });
  const noneQueued = await EmailOutbox.countDocuments({
    recipient: teacher._id,
    type: "target_reached",
  });
  check(noneQueued === 0, "no outbox row for an in-app-only type", `got ${noneQueued}`);
  const notif = await Notification.countDocuments({
    recipient: teacher._id,
    type: "target_reached",
  });
  check(notif === 1, "but the in-app notification still fired", `got ${notif}`);

  // ── 6. Missing address is skipped, not retried forever ──────────────────
  console.log("\n6. recipient with no email address");
  await emit("duty_assigned", { recipient: noAddress.insertedId, data: DUTY_DATA });
  await drainOnce();
  const skipped = await EmailOutbox.findOne({ recipient: noAddress.insertedId });
  check(skipped?.status === "skipped", "row marked skipped", skipped?.status);
  check(
    /no email address/i.test(skipped?.skipReason || ""),
    "skip reason recorded",
    skipped?.skipReason
  );

  // ── cleanup ─────────────────────────────────────────────────────────────
  await EmailOutbox.deleteMany({ recipient: { $in: [teacher._id, noAddress.insertedId] } });
  await Notification.deleteMany({ recipient: { $in: [teacher._id, noAddress.insertedId] } });
  await User.deleteOne({ _id: teacher._id });
  await User.collection.deleteOne({ _id: noAddress.insertedId });

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
