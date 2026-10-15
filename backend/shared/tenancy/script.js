/**
 * Maintenance scripts (backend/scripts) have no signed-in user to name a
 * college, so each one works on a single college, explicitly:
 *
 *   node scripts/seed-rooms.js                 # Main college (the oldest)
 *   COLLEGE=RVCE node scripts/seed-rooms.js    # another college, by code
 *
 * Call right after connecting. Also runs the (idempotent) college migration,
 * so a seed on a fresh database creates Main college first.
 */
const { runAsPlatform, setScriptCollege } = require("./context");

const useCollegeForScript = async () => {
  const { ensureCollegeSetup } = require("../../modules/college/college.migration");
  const main = await ensureCollegeSetup();
  let college = main;
  if (process.env.COLLEGE) {
    const College = require("../../modules/college/college.model");
    college = await runAsPlatform(() => College.findOne({ code: String(process.env.COLLEGE).toUpperCase() }).lean());
    if (!college) throw new Error(`No college with code "${process.env.COLLEGE}"`);
  }
  setScriptCollege(college);
  console.log(`[college] working on "${college.name}" (${college.code})`);
  return college;
};

module.exports = { useCollegeForScript };
