/**
 * Single-college → multi-college migration (MULTI_COLLEGE_PLAN.md §3.5).
 *
 * Runs at every boot before the server accepts requests, and from the seed
 * scripts. Idempotent: after the first run each step finds nothing to do.
 *
 *   1. No college yet → create "Main college" (renamable by the superadmin).
 *   2. Stamp every college-owned document that has no college with the oldest
 *      college — existing production data becomes Main college's. (The tenancy
 *      plugin refuses to create college-less documents, so after the first run
 *      only legacy data ever matches. The superadmin's own account is the one
 *      deliberate exception.)
 *   3. Fill in `examType` on duties and DCS groups that predate it, so exam-type
 *      switches can hide them.
 *   4. Drop the old platform-wide unique indexes on department name/code and
 *      building name — the per-college ones replace them.
 *
 * Works on the raw collections, below the tenancy plugin, in the platform scope.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const collegeRepository = require("./college.repository");
const { runAsPlatform } = require("../../shared/tenancy/context");
const { examTypesFor } = require("../../shared/tenancy/plugin");

const MODULES_DIR = path.join(__dirname, "..");

// Every model must be registered to know which collections are college-owned.
const loadAllModels = () => {
  for (const dir of fs.readdirSync(MODULES_DIR)) {
    const full = path.join(MODULES_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full)) {
      if (file.endsWith(".model.js")) require(path.join(full, file));
    }
  }
};

const collegeOwnedModels = () =>
  mongoose.modelNames()
    .map((name) => mongoose.model(name))
    .filter((model) => model.modelName !== "College" && model.schema.path("college"));

const LEGACY_UNIQUE_INDEXES = {
  Department: ["name_1", "code_1"],
  Building: ["name_1"],
};

const dropLegacyIndexes = async (log) => {
  for (const [modelName, names] of Object.entries(LEGACY_UNIQUE_INDEXES)) {
    const collection = mongoose.model(modelName).collection;
    let existing;
    try {
      existing = await collection.indexes();
    } catch {
      continue; // collection doesn't exist yet
    }
    for (const name of names) {
      if (existing.some((ix) => ix.name === name)) {
        await collection.dropIndex(name);
        log(`[college] dropped platform-wide unique index ${modelName}.${name}`);
      }
    }
  }
};

const backfillExamTypes = async (log) => {
  for (const [modelName, from] of [["Duty", "examSchedule"], ["DCSGroup", "examGroup"]]) {
    const collection = mongoose.model(modelName).collection;
    const refs = await collection.distinct(from, { examType: null, [from]: { $ne: null } });
    if (!refs.length) continue;
    const types = await examTypesFor(from, refs);
    let n = 0;
    for (const ref of refs) {
      const examType = types.get(String(ref));
      if (!examType) continue;
      const r = await collection.updateMany({ [from]: ref, examType: null }, { $set: { examType } });
      n += r.modifiedCount;
    }
    if (n) log(`[college] filled in the exam type on ${n} ${modelName} documents`);
  }
};

const ensureCollegeSetup = ({ log = console.log } = {}) =>
  runAsPlatform(async () => {
    loadAllModels();

    let main = await collegeRepository.findOldest();
    if (!main) {
      main = (
        await collegeRepository.create({
          name: process.env.DEFAULT_COLLEGE_NAME || "Main college",
          code: process.env.DEFAULT_COLLEGE_CODE || "MAIN",
        })
      ).toObject();
      log(`[college] created "${main.name}" (${main.code}) for the existing data`);
    }

    for (const model of collegeOwnedModels()) {
      const filter = { college: null };
      if (model.modelName === "User") filter.roles = { $ne: "superadmin" };
      const r = await model.collection.updateMany(filter, { $set: { college: main._id } });
      if (r.modifiedCount) log(`[college] ${model.modelName}: ${r.modifiedCount} moved into "${main.name}"`);
    }

    await backfillExamTypes(log);
    await dropLegacyIndexes(log);
    return main;
  });

module.exports = { ensureCollegeSetup, loadAllModels };
