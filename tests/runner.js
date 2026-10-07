/**
 * Exam Duty API Test Runner
 *
 * Runs all test suites sequentially and prints a final summary.
 *
 * Usage:
 *   node runner.js                          # Run all tests against localhost:5000
 *   API_URL=https://your-ngrok.app/api node runner.js   # Run against remote
 */

const CONFIG = require("./config");

const suites = [
  { name: "Auth", file: "./01-auth.test.js" },
  { name: "Users", file: "./02-users.test.js" },
  { name: "Departments", file: "./03-departments.test.js" },
  { name: "Infrastructure", file: "./04-infrastructure.test.js" },
  { name: "Exams", file: "./05-exams.test.js" },
  { name: "Exam Groups", file: "./06-exam-groups.test.js" },
  { name: "Duties", file: "./07-duties.test.js" },
  { name: "Change Requests", file: "./08-change-requests.test.js" },
  { name: "Notifications", file: "./09-notifications.test.js" },
  { name: "Create Exams (CIE)", file: "./10-create-exams.test.js" },
  { name: "Notification Events", file: "./11-notification-events.test.js" },
  { name: "Unassign", file: "./12-unassign.test.js" },
  { name: "Confirmation", file: "./13-confirmation.test.js" },
  { name: "Concurrency", file: "./14-concurrency.test.js" },
];

async function main() {
  console.log("═".repeat(60));
  console.log("  EXAM DUTY - API TEST SUITE");
  console.log(`  Target: ${CONFIG.BASE_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allResults = [];
  let token = null;

  for (const suite of suites) {
    try {
      const runFn = require(suite.file);
      const result = await runFn(token);

      // Grab token from auth suite for subsequent tests
      if (suite.name === "Auth" && runFn.token) {
        token = runFn.token;
      }

      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
      allResults.push({
        name: suite.name,
        ...result,
        status: result.failed === 0 ? "PASS" : "FAIL",
      });
    } catch (err) {
      console.log(`\n💥 ${suite.name} suite crashed: ${err.message}\n`);
      allResults.push({
        name: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        status: "CRASH",
        errors: [{ name: "Suite execution", error: err.message }],
      });
      totalFailed++;
    }
  }

  // Final summary
  console.log("\n" + "═".repeat(60));
  console.log("  FINAL RESULTS");
  console.log("═".repeat(60));
  console.log("");

  for (const r of allResults) {
    const icon = r.status === "PASS" ? "✅" : r.status === "CRASH" ? "💥" : "❌";
    console.log(
      `  ${icon} ${r.name.padEnd(25)} ${String(r.passed).padStart(3)} passed  ${String(r.failed).padStart(3)} failed  ${String(r.skipped).padStart(3)} skipped`
    );
  }

  console.log("");
  console.log("─".repeat(60));
  console.log(
    `  TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`
  );
  console.log("─".repeat(60));

  if (totalFailed > 0) {
    console.log("\n❌ Some tests failed. Check output above for details.\n");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
