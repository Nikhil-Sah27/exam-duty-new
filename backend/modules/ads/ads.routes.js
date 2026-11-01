const express = require("express");
const adsController = require("./ads.controller");
const protect = require("../../shared/middleware/auth");

// Teachers read their own ad level (ADS_PLAN.md). Nothing here is writable:
// the switches live in the superadmin console (ads.platform.routes.js).
const router = express.Router();

router.use(protect);

router.get("/status", adsController.status);

module.exports = router;
