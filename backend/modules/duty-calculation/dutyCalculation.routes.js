const express = require("express");
const protect = require("../../shared/middleware/auth");
const controller = require("./dutyCalculation.controller");

const router = express.Router();

router.use(protect);

// ── Per-teacher ────────────────────────────────────────────────────────────
router.get("/my-progress", controller.getMyProgress);
router.get("/my-rs-progress", controller.getMyRsProgress);
router.get("/my-dcs-progress", controller.getMyDcsProgress);
router.get("/teacher/:teacherId/progress", controller.getTeacherProgress);
router.get("/teacher/:teacherId/rs-progress", controller.getTeacherRsProgress);
router.get("/teacher/:teacherId/dcs-progress", controller.getTeacherDcsProgress);

// ── Cohort + institution analytics ─────────────────────────────────────────
router.get("/all-teachers", controller.getAllTeachersProgress);
router.get("/institution", controller.getInstitutionSummary);
router.post("/recalculate", controller.recalculateAll);

// ── Drill-down for tooltips / detail views ─────────────────────────────────
router.get("/semester/:semesterId", controller.getSemesterBreakdown);
router.get("/department/:departmentId", controller.getDepartmentBreakdown);

module.exports = router;
