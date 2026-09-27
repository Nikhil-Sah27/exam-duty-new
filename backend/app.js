const express = require("express");
const cors = require("cors");
const errorHandler = require("./shared/middleware/errorHandler");

const app = express();

// CORS — allow frontend origin
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:4173",
  "http://localhost:5173",
  // Production site (served same-origin behind nginx, but browsers still send
  // an Origin header on POSTs — so these must be allowed explicitly).
  "https://proctavo.com",
  "https://www.proctavo.com",
];

// Extra origins can be supplied at runtime via CLIENT_ORIGINS (comma-separated)
// without a code change.
if (process.env.CLIENT_ORIGINS) {
  for (const o of process.env.CLIENT_ORIGINS.split(",")) {
    const trimmed = o.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  }
}

// Allow ngrok origins dynamically
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /\.ngrok-free\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Module routes
app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/users", require("./modules/user/user.routes"));
app.use("/api/exams", require("./modules/exam/exam.routes"));
app.use("/api/exam-groups", require("./modules/exam/examGroup.routes"));
app.use("/api/create-exams", require("./modules/create-exams/createExams.routes"));
app.use("/api/duties", require("./modules/duty/duty.routes"));
app.use("/api/change-requests", require("./modules/change-request/changeRequest.routes"));
app.use("/api/notifications", require("./modules/notification/notification.routes"));
app.use("/api/notify", require("./modules/notify/notify.routes"));
app.use("/api/departments", require("./modules/department/department.routes"));
app.use("/api/infrastructure", require("./modules/infrastructure/infrastructure.routes"));
app.use("/api/reports", require("./modules/report/report.routes"));
app.use("/api/audit", require("./modules/audit/audit.routes"));
app.use("/api/dcs", require("./modules/dcs/dcsGroup.routes"));
app.use("/api/seat-sharing", require("./modules/seat-sharing/seatSharing.routes"));
app.use("/api/duty-calculation", require("./modules/duty-calculation/dutyCalculation.routes"));

// Global error handler (must be after all routes)
app.use(errorHandler);

module.exports = app;
