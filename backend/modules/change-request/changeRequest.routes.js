const express = require("express");
const controller = require("./changeRequest.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);

router.post("/", controller.submit);
router.get("/", controller.getAll);
router.get("/mine", controller.getMine);
router.get("/replacements/:dutyId", controller.getReplacements);
router.get("/:id", controller.getById);
// Review actions are CS-only. `protect` alone would let any authenticated
// user (RS, DCS, Invigilator) hit these endpoints via curl even though the
// buttons only render in the CS admin UI — the guard closes that gap.
router.patch("/:id/approve", requireRole("cs"), controller.approve);
router.patch("/:id/reject", requireRole("cs"), controller.reject);
// Deleting a change-request record is CS-only and audit-logged.
router.delete("/:id", requireRole("cs"), controller.remove);

module.exports = router;
