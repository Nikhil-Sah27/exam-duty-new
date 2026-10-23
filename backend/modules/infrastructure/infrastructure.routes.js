const express = require("express");
const c = require("./infrastructure.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);
// Teachers only read here; every write is CS-only.

// Buildings
router.post("/buildings", requireRole("cs"), c.createBuilding);
router.get("/buildings", c.getAllBuildings);
router.delete("/buildings/:id", requireRole("cs"), c.deleteBuilding);

// Rooms
router.get("/buildings/:buildingId/rooms", c.getRooms);
router.post("/rooms", requireRole("cs"), c.createRoom);
router.post("/rooms/bulk", requireRole("cs"), c.createRoomsBulk);
router.patch("/rooms/:id", requireRole("cs"), c.updateRoom);
router.delete("/rooms/:id", requireRole("cs"), c.deleteRoom);

module.exports = router;
