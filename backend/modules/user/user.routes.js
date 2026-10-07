const express = require("express");
const userController = require("./user.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

// The Teachers page is open to these roles; only CS may touch CS accounts
// (enforced in user.service) and only CS may bulk-import.
const MANAGERS = ["cs", "dcs", "rs"];

const router = express.Router();

// Public — no auth required (one-time setup)
router.post("/bootstrap", userController.bootstrap);

// All remaining user routes are protected
router.use(protect);

router.post("/import", requireRole("cs"), userController.importUsers);
router.post("/", requireRole(MANAGERS), userController.create);
router.get("/", userController.getAll);
router.get("/:id", userController.getById);
router.put("/:id", requireRole(MANAGERS), userController.update);
router.delete("/:id", requireRole(MANAGERS), userController.remove);
router.patch("/:id/activate", requireRole(MANAGERS), userController.activate);

module.exports = router;
