const authService = require("./auth.service");
const catchAsync = require("../../shared/utils/catchAsync");
const AppError = require("../../shared/utils/AppError");

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
});

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, data: result });
});

const selectRole = catchAsync(async (req, res) => {
  const { role } = req.body || {};
  if (!role) throw new AppError("Role is required", 400);
  const result = await authService.selectRole(req.user.id, role);
  res.status(200).json({ success: true, data: result });
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getUserById(req.user.id, req.user.activeRole);
  res.status(200).json({ success: true, data: user });
});

const forgotPassword = catchAsync(async (req, res) => {
  await authService.requestPasswordReset(req.body?.email);
  // Always generic — never reveal whether the email is registered.
  res.status(200).json({
    success: true,
    message: "If that email is registered, a reset code has been sent.",
  });
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body || {});
  res.status(200).json({
    success: true,
    message: "Password updated. You can now sign in.",
  });
});

module.exports = {
  register,
  login,
  selectRole,
  getMe,
  forgotPassword,
  resetPassword,
};
