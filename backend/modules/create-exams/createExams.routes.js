const express = require("express");
const createExamsController = require("./createExams.controller");
const cieController = require("./cie.controller");
const seeController = require("./see.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);
// Teachers only read here; every write is CS-only.

router.get("/", createExamsController.getStatus);

// CIE workflow
router.get("/cie/departments-data", cieController.getDepartmentsData);
router.post("/cie/calculate-dates", cieController.calculateDates);
router.get("/cie/rooms", cieController.getRooms);
// Legacy two-step endpoints (kept for the existing seed scripts).
router.post("/cie/plan", requireRole("cs"), cieController.createPlan);
router.post("/cie/assign-rooms", requireRole("cs"), cieController.assignRooms);
// New single-call transactional endpoint — used by the deferred-write UI.
router.post("/cie/finalize", requireRole("cs"), cieController.finalize);

// SEE workflow
router.post("/see/plan", requireRole("cs"), seeController.createPlan);
router.post("/see/finalize", requireRole("cs"), seeController.finalize);

module.exports = router;
