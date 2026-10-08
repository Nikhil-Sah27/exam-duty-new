/**
 * Test Configuration
 * Update BASE_URL to point to your running backend server.
 * If using ngrok, set it to your ngrok URL.
 */
const CONFIG = {
  BASE_URL: process.env.API_URL || "http://localhost:5000/api",
  ADMIN_EMAIL: "admin@examduty.com",
  ADMIN_PASSWORD: "Admin123",
  // Platform superadmin for 17-colleges — create it first:
  //   SUPERADMIN_PASSWORD=Super@12345 node backend/scripts/create-superadmin.js superadmin@examduty.test
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || "superadmin@examduty.test",
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || "Super@12345",
};

module.exports = CONFIG;
