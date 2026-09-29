const express = require("express");
const controller = require("./audit.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);

// The audit trail exposes who-did-what across the whole institution — CS only.
router.get("/", requireRole("cs"), controller.list);

module.exports = router;
