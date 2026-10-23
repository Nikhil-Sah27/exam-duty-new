const express = require("express");
const examGroupController = require("./examGroup.controller");
const examScheduleController = require("./examSchedule.controller");
const examRoomController = require("./examRoom.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);
// Teachers only read here; every write is CS-only.

// Literal sub-resource routes MUST be declared before the "/:id" param routes,
// otherwise "/schedules" and "/rooms" are captured by "/:id" (id="schedules")
// and 400 with "Invalid _id".

// Exam Schedules
router.post("/schedules", requireRole("cs"), examScheduleController.create);
router.get("/schedules", examScheduleController.getByGroup);
router.delete("/schedules/:id", requireRole("cs"), examScheduleController.remove);

// Exam Rooms
router.post("/rooms", requireRole("cs"), examRoomController.create);
router.get("/rooms", examRoomController.getBySchedule);
router.delete("/rooms/:id", requireRole("cs"), examRoomController.remove);
router.post("/room-availability", examRoomController.getRoomAvailability);

// Exam Groups
router.post("/", requireRole("cs"), examGroupController.create);
router.get("/", examGroupController.getAll);
router.get("/:id", examGroupController.getById);
router.get("/:id/details", examGroupController.getDetails);
router.get("/:id/duty-status", examGroupController.getDutyStatus);
router.patch("/:id", requireRole("cs"), examGroupController.update);
router.delete("/:id", requireRole("cs"), examGroupController.remove);

module.exports = router;
