const express = require("express");
const pushController = require("./push.controller");
const protect = require("../../shared/middleware/auth");

const router = express.Router();

// Any signed-in role may register its phone; the app itself only serves
// Invigilator / RS / DCS.
router.use(protect);

router.post("/devices", pushController.register);
router.delete("/devices", pushController.unregister);
router.get("/deliveries", pushController.myDeliveries);

module.exports = router;
