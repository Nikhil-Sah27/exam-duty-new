const express = require("express");
const authController = require("./auth.controller");
const protect = require("../../shared/middleware/auth");
const allowUnselectedRole = require("../../shared/middleware/allowUnselectedRole");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
// Password reset via emailed OTP (both public).
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
// Uses a special middleware that accepts tokens without an activeRole claim,
// since this endpoint is what turns a tempToken into a full token.
router.post("/select-role", allowUnselectedRole, authController.selectRole);
router.get("/me", protect, authController.getMe);

module.exports = router;
