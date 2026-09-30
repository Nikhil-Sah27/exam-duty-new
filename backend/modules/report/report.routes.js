const express = require("express");
const controller = require("./report.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);

// Who is / isn't confirming or selecting duties (REMINDERS_PLAN.md §D).
router.get("/responsiveness", requireRole("cs"), controller.responsiveness);

module.exports = router;
