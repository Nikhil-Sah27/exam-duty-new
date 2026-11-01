const express = require("express");
const collegeController = require("./college.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

// The superadmin's console (MULTI_COLLEGE_PLAN.md §3.3): colleges, their
// feature switches and CS accounts — never a college's teachers, exams or duties.
const router = express.Router();

router.use(protect, requireRole("superadmin"));

router.get("/colleges", collegeController.list);
router.post("/colleges", collegeController.create);
router.get("/colleges/:id", collegeController.getById);
router.patch("/colleges/:id", collegeController.update);
router.post("/colleges/:id/cs", collegeController.addCs);
router.patch("/colleges/:id/cs/:userId", collegeController.setCsActive);
router.post("/colleges/:id/cs/:userId/reset-password", collegeController.resetCsPassword);

// The platform-wide ads master switch (ADS_PLAN.md); per-college switches are features above.
router.use("/ads", require("../ads/ads.platform.routes"));

module.exports = router;
