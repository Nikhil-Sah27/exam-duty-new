const express = require("express");
const cors = require("cors");
const errorHandler = require("./shared/middleware/errorHandler");
const { corsOrigin } = require("./shared/config/cors");

const app = express();

// CORS — allow frontend origins (list in shared/config/cors.js)
app.use(cors({ origin: corsOrigin, credentials: true }));

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
app.use("/api/messages", require("./modules/message/message.routes"));

// Global error handler (must be after all routes)
app.use(errorHandler);

module.exports = app;
