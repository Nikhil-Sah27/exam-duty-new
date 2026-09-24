/**
 * Dump every collection in the connected MongoDB database to a single JSON
 * file at the project root. Uses MongoDB Extended JSON so ObjectIds, Dates,
 * and other BSON types round-trip through the companion restore script.
 *
 * Usage:
 *   cd backend && node scripts/dump-database.js [output-path]
 *
 * Default output: <project-root>/db-dump.json
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

const OUTPUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "..", "db-dump.json");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  const dump = {
    exportedAt: new Date().toISOString(),
    database: db.databaseName,
    collections: {},
  };

  let totalDocs = 0;
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    dump.collections[name] = docs;
    totalDocs += docs.length;
    console.log(`  ${name.padEnd(30)} ${docs.length} docs`);
  }

  const json = EJSON.stringify(dump, null, 2, { relaxed: false });
  fs.writeFileSync(OUTPUT, json);

  const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(
    `\nWrote ${Object.keys(dump.collections).length} collections / ${totalDocs} docs → ${OUTPUT} (${sizeKB} KB)`
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
