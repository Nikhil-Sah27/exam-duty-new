/**
 * One-shot cohort seed: 20 Associate Professors, 15 Assistant Professors,
 * 25 Professors, 10 HOD/Deans, and 1 additional CS admin. Names are drawn
 * from disjoint pools per designation so this script can be re-run safely
 * (existing emails are skipped) and doesn't collide with earlier seeds.
 *
 * Roles are DERIVED from designation per the roleResolver rules — the
 * script passes designation only, plus the roles it would resolve to.
 *
 * Run: node scripts/seed-cohort.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");
const {
  resolveRolesFromDesignation,
} = require("../shared/utils/roleResolver");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Pass1234";

const DEPARTMENTS = [
  "Computer Science and Engineering",
  "Information Science and Engineering",
  "Electronics and Communication Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
];

// Disjoint name pools so the four cohorts cannot generate duplicate emails.
const ASSOCIATE_NAMES = [
  "Ravi Menon", "Sunita Kapoor", "Deepak Chaudhary", "Meera Iyer", "Arun Bhatt",
  "Kavita Sharma", "Sanjay Nair", "Preeti Malhotra", "Ashok Reddy", "Neha Sinha",
  "Rakesh Verma", "Ritu Agarwal", "Vinod Gupta", "Shalini Rao", "Manoj Yadav",
  "Anita Desai", "Suresh Iyengar", "Rekha Krishnamurthy", "Prakash Chopra", "Geeta Menon",
];

const ASSISTANT_NAMES = [
  "Rohit Bansal", "Swati Deshmukh", "Aakash Trivedi", "Nisha Pandey", "Karan Bhatia",
  "Pooja Shetty", "Amit Kulkarni", "Ritika Saxena", "Vikas Jha", "Shweta Mehra",
  "Naveen Rai", "Anjali Kaul", "Harish Bhardwaj", "Sneha Tiwari", "Rajat Sharma",
];

const PROFESSOR_NAMES = [
  "Dr. Anil Kumar", "Dr. Sujata Bose", "Dr. Ramesh Iyer", "Dr. Vandana Rao", "Dr. Prem Chand",
  "Dr. Lakshmi Nair", "Dr. Bharat Sinha", "Dr. Rashmi Joshi", "Dr. Ajay Chopra", "Dr. Kiran Bedi",
  "Dr. Umesh Patel", "Dr. Divya Mishra", "Dr. Sudhir Ranganathan", "Dr. Malini Krishnan", "Dr. Naresh Goyal",
  "Dr. Padma Balaji", "Dr. Shankar Pillai", "Dr. Jyoti Bhaskar", "Dr. Vivek Aggarwal", "Dr. Nirmala Devi",
  "Dr. Raghav Menon", "Dr. Aruna Bharti", "Dr. Mohan Lal", "Dr. Kalpana Rathi", "Dr. Satish Prabhu",
];

const HOD_NAMES = [
  "Prof. Ramanathan CSE", "Prof. Suresh Ravi ISE", "Prof. Kavitha Krishnan ECE",
  "Prof. Ganesh Iyer ME", "Prof. Padmini Rao CV", "Prof. Bhavana Jain",
  "Prof. Sanjeev Kumar", "Prof. Meghna Deshpande", "Prof. Rajendra Nair",
  "Prof. Vasudha Menon",
];

const CS_NAMES = ["Assistant Admin"];

const emailFromName = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return `${slug}@examduty.com`;
};

const buildCohort = (names, designation) => {
  const roles =
    designation === "Other"
      ? ["cs"]
      : resolveRolesFromDesignation(designation) || [];
  return names.map((name, i) => ({
    name,
    email: emailFromName(name),
    password: DEFAULT_PASSWORD,
    designation,
    roles,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
  }));
};

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const users = [
    ...buildCohort(ASSOCIATE_NAMES, "Associate Professor"),
    ...buildCohort(ASSISTANT_NAMES, "Assistant Professor"),
    ...buildCohort(PROFESSOR_NAMES, "Professor"),
    ...buildCohort(HOD_NAMES, "HOD/Dean"),
    ...buildCohort(CS_NAMES, "Other"),
  ];

  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");

  const byDesignation = {};
  let skipped = 0;

  for (const user of users) {
    const exists = await usersCollection.findOne({ email: user.email });
    if (exists) {
      skipped++;
      continue;
    }
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    await usersCollection.insertOne({
      name: user.name,
      email: user.email,
      password: hashedPassword,
      // Placeholder contact so DCS/CS directories always have a number to show.
      phone: `+91 ${9800000000 + (skipped + Object.values(byDesignation).reduce((a, b) => a + b, 0))}`,
      roles: user.roles,
      department: user.department,
      designation: user.designation,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    byDesignation[user.designation] = (byDesignation[user.designation] || 0) + 1;
  }

  console.log("\nCreated:");
  Object.entries(byDesignation)
    .sort()
    .forEach(([d, n]) => console.log(`  ${d.padEnd(22)} ${n}`));
  console.log(`\nTotal created: ${Object.values(byDesignation).reduce((a, b) => a + b, 0)}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`\nDefault password for all new accounts: ${DEFAULT_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
