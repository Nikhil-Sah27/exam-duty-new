const axios = require("axios");
const CONFIG = require("./config");

const api = axios.create({
  baseURL: CONFIG.BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Track test results
let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

function setToken(token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

function clearToken() {
  delete api.defaults.headers.common["Authorization"];
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const msg = err.response
      ? `${err.response.status} - ${JSON.stringify(err.response.data)}`
      : err.message;
    errors.push({ name, error: msg });
    console.log(`  ❌ ${name}`);
    console.log(`     → ${msg}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} (skipped: ${reason})`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, field) {
  if (actual !== expected) {
    throw new Error(`${field}: expected "${expected}", got "${actual}"`);
  }
}

function assertExists(value, field) {
  if (value === undefined || value === null) {
    throw new Error(`${field} should exist but is ${value}`);
  }
}

function assertStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}`
    );
  }
}

function summary(suiteName) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📊 ${suiteName} Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (errors.length > 0) {
    console.log(`\n❌ Failures:`);
    errors.forEach((e) => console.log(`   • ${e.name}: ${e.error}`));
  }
  console.log(`${"─".repeat(50)}\n`);
  return { passed, failed, skipped, errors };
}

function resetCounters() {
  passed = 0;
  failed = 0;
  skipped = 0;
  errors.length = 0;
}

// Returns an ISO date string (YYYY-MM-DD) N days from today. Used so exam/duty
// dates are always in the future — the backend rejects past start dates and
// past-duty change requests.
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  api,
  setToken,
  clearToken,
  test,
  skip,
  assert,
  assertEqual,
  assertExists,
  assertStatus,
  summary,
  resetCounters,
  futureDate,
  CONFIG,
};
