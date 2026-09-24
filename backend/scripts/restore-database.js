/**
 * Restore the JSON produced by `dump-database.js` into the connected MongoDB
 * database. Uses MongoDB Extended JSON so ObjectIds, Dates, and other BSON
 * types are parsed back to their original types.
 *
 * Usage:
 *   cd backend && node scripts/restore-database.js [input-path] [--drop]
 *
 * Default input: <project-root>/db-dump.json
 *   --drop  Drop each collection before inserting (destructive; otherwise
 *           existing documents with duplicate _ids will cause an error).
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

const args = process.argv.slice(2);
const drop = args.includes("--drop");
const inputArg = args.find((a) => !a.startsWith("--"));
const INPUT = inputArg
  ? path.resolve(inputArg)
  : path.resolve(__dirname, "..", "..", "db-dump.json");

(async () => {
  if (!fs.existsSync(INPUT)) {
    console.error(`Dump file not found: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, "utf8");
  const dump = EJSON.parse(raw, { relaxed: false });

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  console.log(
    `Restoring into '${db.databaseName}' from ${INPUT}${drop ? " (--drop)" : ""}`
  );

  let totalDocs = 0;
  for (const [name, docs] of Object.entries(dump.collections || {})) {
    if (drop) {
      try {
        await db.collection(name).drop();
      } catch (e) {
        // collection didn't exist — fine
      }
    }
    if (docs.length > 0) {
      await db.collection(name).insertMany(docs, { ordered: false });
    }
    totalDocs += docs.length;
    console.log(`  ${name.padEnd(30)} ${docs.length} docs`);
  }

  console.log(`\nRestored ${totalDocs} docs.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
