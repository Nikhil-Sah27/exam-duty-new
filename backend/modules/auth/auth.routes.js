const express = require("express");
const authController = require("./auth.controller");
const protect = require("../../shared/middleware/auth");
const allowUnselectedRole = require("../../shared/middleware/allowUnselectedRole");
const { platformScope } = require("../../shared/tenancy/context");

const router = express.Router();

// Signed-out endpoints look users up by email/id across all colleges (emails
// are unique platform-wide), so they run in the platform scope.
router.post("/register", platformScope, authController.register);
router.post("/login", platformScope, authController.login);
// Password reset via emailed OTP (both public).
router.post("/forgot-password", platformScope, authController.forgotPassword);
router.post("/reset-password", platformScope, authController.resetPassword);
// Uses a special middleware that accepts tokens without an activeRole claim,
// since this endpoint is what turns a tempToken into a full token.
router.post("/select-role", allowUnselectedRole, platformScope, authController.selectRole);
router.get("/me", protect, authController.getMe);

module.exports = router;
