const express = require("express");
const userController = require("./user.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

// Public — no auth required (one-time setup)
router.post("/bootstrap", userController.bootstrap);

// All remaining user routes are protected
router.use(protect);

// Reads stay open (assignment pickers, messaging); every account write is the
// exam cell's job — CS only.
router.get("/", userController.getAll);
router.get("/:id", userController.getById);
router.post("/import", requireRole("cs"), userController.importUsers);
router.post("/", requireRole("cs"), userController.create);
router.put("/:id", requireRole("cs"), userController.update);
router.delete("/:id", requireRole("cs"), userController.remove);
router.patch("/:id/activate", requireRole("cs"), userController.activate);

module.exports = router;
