const express = require("express");
const controller = require("./seatSharing.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();
router.use(protect);
// Teachers only read here; every write is CS-only.

// Discovery — the create-exams UI queries this to surface "Use Shared Seats"
// banners on new exams that overlap someone else's shareable room.
router.post("/available", controller.getAvailable);

// Post-hoc marking (endpoint only; the create-exams flow does this transactionally).
router.post("/mark-shareable", requireRole("cs"), controller.markShareable);
router.post("/unmark-shareable", requireRole("cs"), controller.unmarkShareable);

// Release a specific allocation (used by consumer edits / undo).
router.delete("/allocations/:id", requireRole("cs"), controller.releaseAllocation);

// Read helpers for ExamDetails read-only badges.
router.get("/by-exam-room/:examRoomId", controller.getByExamRoom);
router.get("/by-schedule/:scheduleId", controller.getBySchedule);

module.exports = router;
