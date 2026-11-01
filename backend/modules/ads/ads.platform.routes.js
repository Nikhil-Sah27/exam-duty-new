const express = require("express");
const adsController = require("./ads.controller");

// The ads master switch, mounted inside the superadmin console's router
// (college.routes.js → /api/platform/ads), which has already applied
// protect + requireRole("superadmin").
const router = express.Router();

router.get("/", adsController.getSettings);
router.patch("/", adsController.updateSettings);

module.exports = router;
