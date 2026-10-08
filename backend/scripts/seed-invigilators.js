/**
 * Seed script: creates 30 invigilators distributed across the 5 departments,
 * split between "Assistant Professor" and "Associate Professor" — the two
 * designations eligible for invigilator duty.
 *
 * Run: node scripts/seed-invigilators.js
 *
 * Skips any user whose email already exists.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Invig123";

const DEPARTMENTS = [
  "Computer Science and Engineering",
  "Information Science and Engineering",
  "Electronics and Communication Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
];

// 6 invigilators per department = 30 total.
// Per dept: 4 Assistant Professor + 2 Associate Professor.
const NAMES_PER_DEPT = [
  ["Aarav Sharma", "Diya Patel", "Kabir Reddy", "Ishani Nair", "Rohan Iyer", "Meera Krishnan"],
  ["Vihaan Menon", "Ananya Rao", "Arjun Pillai", "Saanvi Bhat", "Kartik Kulkarni", "Priya Deshpande"],
  ["Aditya Joshi", "Neha Malhotra", "Vikram Chowdhury", "Riya Kapoor", "Aditya Verma", "Sneha Agarwal"],
  ["Rahul Gupta", "Anjali Singh", "Nikhil Yadav", "Pooja Mishra", "Sameer Tiwari", "Divya Chauhan"],
  ["Aryan Bansal", "Kavya Saxena", "Harsh Trivedi", "Tanvi Jain", "Manav Aggarwal", "Isha Chopra"],
];

const emailFromName = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return `${slug}@examduty.com`;
};

const buildInvigilators = () => {
  const users = [];
  DEPARTMENTS.forEach((dept, deptIdx) => {
    const names = NAMES_PER_DEPT[deptIdx];
    names.forEach((name, i) => {
      // First 2 in each dept are Associate Professor, remaining 4 are Assistant.
      // Both designations grant [rs, invigilator] per the roleResolver rules.
      const designation =
        i < 2 ? "Associate Professor" : "Assistant Professor";
      users.push({
        name,
        email: emailFromName(name),
        password: DEFAULT_PASSWORD,
        roles: ["rs", "invigilator"],
        department: dept,
        designation,
      });
    });
  });
  return users;
};

async function seed() {
  await mongoose.connect(MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const users = buildInvigilators();
  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const exists = await usersCollection.findOne({ email: user.email });
    if (exists) {
      console.log(`SKIP: ${user.email} (already exists)`);
      skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

    await usersCollection.insertOne({
      name: user.name,
      email: user.email,
      password: hashedPassword,
      phone: null,
      roles: user.roles,
      department: user.department,
      designation: user.designation,
      isActive: true,
      college: college._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(
      `CREATED: ${user.email.padEnd(40)} ${user.designation.padEnd(22)} ${user.department}`
    );
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  console.log(`Default password for all seeded invigilators: ${DEFAULT_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
