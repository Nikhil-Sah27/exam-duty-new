const express = require("express");
const examController = require("./exam.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

// All exam routes are protected
router.use(protect);
// Teachers only read here; every write is CS-only.

router.post("/", requireRole("cs"), examController.create);
router.get("/", examController.getAll);
router.get("/:id", examController.getById);
router.put("/:id", requireRole("cs"), examController.update);
router.patch("/:id/cancel", requireRole("cs"), examController.cancel);
router.patch("/:id/restore", requireRole("cs"), examController.restore);

module.exports = router;
