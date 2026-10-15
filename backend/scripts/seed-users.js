/**
 * Seed script: creates default users for all roles.
 *
 * Run: node scripts/seed-users.js
 *
 * Skips any user whose email already exists in the database.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";
const SALT_ROUNDS = 10;

// Designations here follow the designation → roles rules enforced by the app
// (backend/shared/utils/roleResolver.js). "Other" is the only designation that
// permits CS.
const seedUsers = [
  {
    name: "Admin",
    email: "admin@examduty.com",
    password: "Admin123",
    designation: "Other",
    roles: ["cs"],
    department: "Administration",
  },
  {
    name: "Deputy Admin",
    email: "dcs@examduty.com",
    password: "Dcs12345",
    designation: "HOD/Dean",
    roles: ["dcs"],
    department: "Administration",
  },
  {
    name: "Resource Scheduler",
    email: "rs@examduty.com",
    password: "Rs123456",
    designation: "Professor",
    roles: ["rs"],
    department: "Examination Cell",
  },
  {
    name: "Invigilator One",
    email: "invigilator@examduty.com",
    password: "Invig123",
    designation: "Assistant Professor",
    roles: ["rs", "invigilator"],
    department: "Computer Science",
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");

  let created = 0;
  let skipped = 0;

  for (const user of seedUsers) {
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

    console.log(`CREATED: ${user.email} (${user.roles.join(", ")})`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
