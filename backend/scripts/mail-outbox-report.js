/**
 * Email delivery report — what the notification system tried to send.
 *
 *   node scripts/mail-outbox-report.js            # summary + 20 most recent
 *   node scripts/mail-outbox-report.js 50         # summary + 50 most recent
 *   node scripts/mail-outbox-report.js --failed   # only failures, with errors
 *   node scripts/mail-outbox-report.js --retry    # re-queue failed rows
 *
 * With MAIL_TRANSPORT=console (the default) rows still move to `sent` — the
 * transport renders and logs instead of delivering, so this is how you confirm
 * the pipeline works before pointing it at a real mail server.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../shared/config/db");
const EmailOutbox = require("../modules/mail/emailOutbox.model");

const args = process.argv.slice(2);
const failedOnly = args.includes("--failed");
const retry = args.includes("--retry");
const limit = Number(args.find((a) => /^\d+$/.test(a))) || 20;

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

const main = async () => {
  await connectDB();

  if (retry) {
    const res = await EmailOutbox.updateMany(
      { status: "failed" },
      { status: "pending", nextAttemptAt: new Date(), attempts: 0, lastError: null }
    );
    console.log(`Re-queued ${res.modifiedCount} failed email(s) for delivery.`);
    await mongoose.disconnect();
    return;
  }

  const counts = await EmailOutbox.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log("\n  EMAIL OUTBOX");
  console.log("  " + "─".repeat(70));
  if (counts.length === 0) {
    console.log("  (empty — no notification has queued an email yet)\n");
  } else {
    console.log(
      "  " + counts.map((c) => `${c._id}: ${c.count}`).join("   ")
    );
  }

  const byType = await EmailOutbox.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  if (byType.length > 0) {
    console.log("\n  By type");
    for (const t of byType) console.log(`    ${pad(t._id, 32)} ${t.count}`);
  }

  const filter = failedOnly ? { status: { $in: ["failed", "skipped"] } } : {};
  const rows = await EmailOutbox.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("recipient", "name email")
    .lean();

  console.log(`\n  ${failedOnly ? "Failed / skipped" : "Most recent"} (${rows.length})`);
  console.log("  " + "─".repeat(70));
  for (const r of rows) {
    const who = r.recipient?.email || String(r.recipient);
    console.log(
      `  ${pad(r.status, 11)} ${pad(r.type, 26)} ${pad(who, 30)} ${
        r.attempts > 1 ? `(${r.attempts} attempts) ` : ""
      }`
    );
    if (r.lastError) console.log(`      error: ${r.lastError}`);
    if (r.skipReason) console.log(`      skipped: ${r.skipReason}`);
  }
  console.log("");

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error("mail-outbox-report failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
