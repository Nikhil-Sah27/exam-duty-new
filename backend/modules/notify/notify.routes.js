const express = require("express");
const controller = require("./notify.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);
router.use(requireRole("cs"));

router.post("/", controller.send);

module.exports = router;
