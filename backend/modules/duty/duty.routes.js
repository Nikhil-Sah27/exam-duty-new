const express = require("express");
const dutyController = require("./duty.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

// All duty routes are protected
router.use(protect);

router.post("/self-assign", dutyController.selfAssign);
router.post("/self-assign-group", dutyController.selfAssignGroup);
router.post("/admin-assign", requireRole("cs"), dutyController.adminAssign);
router.post("/admin-assign-group", requireRole("cs"), dutyController.adminAssignGroup);
router.post("/admin-unassign-group", requireRole("cs"), dutyController.adminUnassignGroup);
router.post("/invigilators-for-rooms", dutyController.invigilatorsForRooms);
router.get("/", dutyController.getAll);
router.get("/:id", dutyController.getById);
router.patch("/:id/cancel", dutyController.cancel);

module.exports = router;
