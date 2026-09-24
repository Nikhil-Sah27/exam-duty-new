const express = require("express");
const userController = require("./user.controller");
const protect = require("../../shared/middleware/auth");

const router = express.Router();

// Public — no auth required (one-time setup)
router.post("/bootstrap", userController.bootstrap);

// All remaining user routes are protected
router.use(protect);

router.post("/", userController.create);
router.get("/", userController.getAll);
router.get("/:id", userController.getById);
router.put("/:id", userController.update);
router.delete("/:id", userController.remove);
router.patch("/:id/activate", userController.activate);

module.exports = router;
