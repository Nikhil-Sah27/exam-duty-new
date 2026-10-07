#!/usr/bin/env node
/**
 * Architecture ratchet — backend module boundaries.
 *
 * CLAUDE.md rule: "No cross-domain repository calls — services call other
 * domains' services." A module under `backend/modules/<domain>/` must not
 * `require` another domain's `*.repository` or `*.model` directly (that skips
 * the service layer and its invariants).
 *
 * This is a RATCHET, not a big-bang cleanup: the `BASELINE` below freezes the
 * cross-domain imports that existed when the guard was introduced. The check
 * FAILS only when a NEW cross-domain `.model`/`.repository` import appears that
 * is not in the baseline. Over time, migrate a baselined import to a
 * service→service call and delete its line here — the list should only shrink.
 *
 * Intentional, documented exceptions already sit in the baseline (the
 * `exam-cleanup/*` cascade orchestrator; `user/user.model.js` re-exporting the
 * shared `auth` User schema), so they pass without special-casing.
 *
 * Usage:  node scripts/check-architecture.js            (fail on new violations)
 *         node scripts/check-architecture.js --update   (print a fresh baseline)
 */
const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "..", "modules");

// Baselined cross-domain `.model`/`.repository` imports (key: "<src rel path> => <require path>").
// Frozen snapshot — only remove entries as they are migrated to service calls.
const BASELINE = new Set([
  "change-request/changeRequest.service.js => ../auth/auth.model",
  "change-request/changeRequest.service.js => ../dcs/dcsGroup.repository",
  "change-request/changeRequest.service.js => ../duty/duty.model",
  "change-request/changeRequest.service.js => ../duty/duty.repository",
  "change-request/changeRequest.service.js => ../exam/examGroup.repository",
  "change-request/changeRequest.service.js => ../exam/examRoom.repository",
  "change-request/changeRequest.service.js => ../exam/examSchedule.repository",
  "create-exams/assignmentResolver.js => ../department/course.model",
  "create-exams/cie.service.js => ../department/course.model",
  "create-exams/cie.service.js => ../department/department.model",
  "create-exams/cie.service.js => ../department/electiveGroup.model",
  "create-exams/cie.service.js => ../department/semester.model",
  "create-exams/cie.service.js => ../exam/examGroup.model",
  "create-exams/cie.service.js => ../exam/examRoom.model",
  "create-exams/cie.service.js => ../exam/examSchedule.model",
  "create-exams/cie.service.js => ../infrastructure/building.model",
  "create-exams/cie.service.js => ../infrastructure/infrastructure.model",
  "create-exams/examNotification.service.js => ../auth/auth.model",
  "create-exams/see.service.js => ../department/course.model",
  "create-exams/see.service.js => ../department/department.model",
  "create-exams/see.service.js => ../department/electiveGroup.model",
  "create-exams/see.service.js => ../department/semester.model",
  "create-exams/see.service.js => ../exam/examGroup.model",
  "create-exams/see.service.js => ../exam/examRoom.model",
  "create-exams/see.service.js => ../exam/examSchedule.model",
  "dcs/dcsGroup.service.js => ../auth/auth.model",
  "dcs/dcsGroup.service.js => ../department/department.model",
  "dcs/dcsGroup.service.js => ../department/semester.model",
  "dcs/dcsGroup.service.js => ../duty/duty.model",
  "dcs/dcsGroup.service.js => ../duty/duty.repository",
  "dcs/dcsGroup.service.js => ../exam/examGroup.repository",
  "dcs/dcsGroup.service.js => ../exam/examRoom.repository",
  "dcs/dcsGroup.service.js => ../exam/examSchedule.repository",
  "duty-calculation/dutyCalculation.service.js => ../auth/auth.model",
  "duty-calculation/dutyCalculation.service.js => ../dcs/dcsGroup.model",
  "duty-calculation/dutyCalculation.service.js => ../department/course.model",
  "duty-calculation/dutyCalculation.service.js => ../department/department.model",
  "duty-calculation/dutyCalculation.service.js => ../department/semester.model",
  "duty-calculation/dutyCalculation.service.js => ../duty/duty.model",
  "duty-calculation/dutyCalculation.service.js => ../exam/examGroup.model",
  "duty-calculation/dutyCalculation.service.js => ../exam/examGroup.repository",
  "duty-calculation/dutyCalculation.service.js => ../infrastructure/infrastructure.model",
  "duty/duty.repository.js => ../exam/examRoom.model",
  "duty/duty.service.js => ../auth/auth.model",
  "duty/duty.service.js => ../dcs/dcsGroup.repository",
  "duty/duty.service.js => ../exam/exam.model",
  "duty/duty.service.js => ../exam/examGroup.repository",
  "duty/duty.service.js => ../exam/examRoom.repository",
  "duty/duty.service.js => ../exam/examSchedule.repository",
  "exam-cleanup/services/changeRequestCleanupService.js => ../../change-request/changeRequest.repository",
  "exam-cleanup/services/dutyReleaseService.js => ../../duty/duty.model",
  "exam-cleanup/services/examDeletionService.js => ../../dcs/dcsGroup.repository",
  "exam-cleanup/services/examDeletionService.js => ../../exam/exam.model",
  "exam-cleanup/services/examDeletionService.js => ../../exam/exam.repository",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examGroup.model",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examGroup.repository",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examRoom.model",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examRoom.repository",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examSchedule.model",
  "exam-cleanup/services/examDeletionService.js => ../../exam/examSchedule.repository",
  "exam-cleanup/utils/scheduleReleaseUtils.js => ../../duty/duty.model",
  "exam-cleanup/utils/scheduleReleaseUtils.js => ../../exam/examRoom.model",
  "exam-cleanup/utils/scheduleReleaseUtils.js => ../../exam/examSchedule.model",
  "exam/examGroup.service.js => ../create-exams/ciePlan.model",
  "exam/examGroup.service.js => ../duty/duty.model",
  "exam/examGroup.service.js => ../seat-sharing/sharedSeatAllocation.model",
  "mail/mail.dispatcher.js => ../auth/auth.model",
  "notification/notification.jobs.js => ../duty/duty.model",
  "notification/reminder.jobs.js => ../dcs/dcsGroup.model",
  "notification/reminder.jobs.js => ../duty/duty.model",
  "notification/reminder.jobs.js => ../exam/examGroup.model",
  "notification/reminder.jobs.js => ../exam/examRoom.model",
  "notification/reminder.jobs.js => ../exam/examSchedule.model",
  "notify/notify.service.js => ../user/user.repository",
  "seat-sharing/seatSharing.service.js => ../exam/examRoom.model",
  "seat-sharing/seatSharing.service.js => ../exam/examSchedule.model",
  "user/user.model.js => ../auth/auth.model",
]);

// require("...") / require('...') targeting a *.model or *.repository (optional .js).
const REQUIRE_RE =
  /require\(\s*["']([^"']*\.(?:model|repository))(?:\.js)?["']\s*\)/g;

/** All .js files under modules/, as paths relative to modules/ (posix slashes). */
function listModuleFiles(dir, rootRel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = rootRel ? `${rootRel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...listModuleFiles(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(rel);
    }
  }
  return out;
}

/** Top-level module (domain) name for a modules-relative path. */
const domainOf = (relPath) => relPath.split("/")[0];

/** Resolve a require target to its domain, or null if it leaves modules/. */
function targetDomain(srcRel, requirePath) {
  const resolved = path.resolve(path.dirname(path.join(MODULES_DIR, srcRel)), requirePath);
  const relFromModules = path.relative(MODULES_DIR, resolved).split(path.sep).join("/");
  if (relFromModules.startsWith("..")) return null; // escaped modules/
  return relFromModules.split("/")[0];
}

function scan() {
  const found = []; // { key, srcRel, requirePath }
  for (const srcRel of listModuleFiles(MODULES_DIR)) {
    const content = fs.readFileSync(path.join(MODULES_DIR, srcRel), "utf8");
    let m;
    REQUIRE_RE.lastIndex = 0;
    while ((m = REQUIRE_RE.exec(content)) !== null) {
      const requirePath = m[1];
      if (!requirePath.startsWith(".")) continue; // only relative imports cross domains
      const tgt = targetDomain(srcRel, requirePath);
      if (!tgt) continue;
      if (tgt === domainOf(srcRel)) continue; // same domain — fine
      found.push({ key: `${srcRel} => ${requirePath}`, srcRel, requirePath });
    }
  }
  return found;
}

function main() {
  const found = scan();
  const currentKeys = new Set(found.map((f) => f.key));

  if (process.argv.includes("--update")) {
    console.log("const BASELINE = new Set([");
    for (const k of [...currentKeys].sort()) console.log(`  ${JSON.stringify(k)},`);
    console.log("]);");
    return;
  }

  const added = found.filter((f) => !BASELINE.has(f.key));
  const resolved = [...BASELINE].filter((k) => !currentKeys.has(k));

  if (resolved.length) {
    console.log(
      `\n✓ ${resolved.length} baselined cross-domain import(s) no longer present ` +
        `— nice. Please delete these lines from BASELINE in scripts/check-architecture.js:`,
    );
    for (const k of resolved.sort()) console.log(`    - ${k}`);
  }

  if (added.length) {
    console.error(
      `\n✗ ${added.length} NEW cross-domain .model/.repository import(s) detected.\n` +
        `  A module must not require another domain's model/repository directly — ` +
        `call that domain's service instead (CLAUDE.md). If this is genuinely ` +
        `unavoidable, add the line to BASELINE in scripts/check-architecture.js ` +
        `with justification.\n`,
    );
    for (const f of added.sort((a, b) => a.key.localeCompare(b.key))) {
      console.error(`    + ${f.key}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(
    `✓ No new cross-domain model/repository imports ` +
      `(${currentKeys.size} baselined, ${BASELINE.size} tracked).`,
  );
}

main();
