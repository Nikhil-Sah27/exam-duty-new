/**
 * Create (or re-key) the platform superadmin — the only way to get one; there
 * is no endpoint for it (MULTI_COLLEGE_PLAN.md §3.3).
 *
 *   SUPERADMIN_PASSWORD='…' node scripts/create-superadmin.js you@example.com "Your Name"
 *   node scripts/create-superadmin.js you@example.com          # generates a password, printed once
 *   node scripts/create-superadmin.js you@example.com --reset   # new password for an existing superadmin
 *
 * The superadmin belongs to no college. Its email can't already be a college
 * account (emails are unique platform-wide).
 */
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { runAsPlatform } = require("../shared/tenancy/context");
const { ensureCollegeSetup } = require("../modules/college/college.migration");

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const [email, name] = args.filter((a) => !a.startsWith("--"));

const main = async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: node scripts/create-superadmin.js <email> ["Name"] [--reset]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  await ensureCollegeSetup();
  const User = require("../modules/auth/auth.model");

  const generated = !process.env.SUPERADMIN_PASSWORD;
  const password = process.env.SUPERADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  if (password.length < 8) throw new Error("SUPERADMIN_PASSWORD must be at least 8 characters");
  const hashed = await bcrypt.hash(password, 10);

  await runAsPlatform(async () => {
    const existing = await User.findOne({ email: email.toLowerCase(), isActive: { $in: [true, false] } });
    if (existing && !(existing.roles || []).includes("superadmin")) {
      throw new Error(`${email} is already a college account — use a different email for the superadmin`);
    }
    if (existing && !reset) {
      throw new Error(`${email} is already the superadmin — add --reset to give it a new password`);
    }
    if (existing) {
      existing.password = hashed;
      existing.isActive = true;
      await existing.save();
    } else {
      await User.create({
        name: name || "Superadmin",
        email,
        password: hashed,
        phone: process.env.SUPERADMIN_PHONE || "-",
        designation: "Other",
        roles: ["superadmin"],
        college: null,
      });
    }
  });

  console.log(`${reset ? "Reset" : "Created"} superadmin ${email}.`);
  if (generated) console.log(`Password (shown once — store it now): ${password}`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error("Failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
