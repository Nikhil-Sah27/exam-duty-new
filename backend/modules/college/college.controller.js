const collegeService = require("./college.service");
const catchAsync = require("../../shared/utils/catchAsync");

// Superadmin only (routes enforce it). Runs in the platform scope.

const list = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: await collegeService.listColleges() });
});

const getById = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: await collegeService.getCollegeDetail(req.params.id) });
});

const create = catchAsync(async (req, res) => {
  const college = await collegeService.createCollege(req.body || {}, req.user);
  res.status(201).json({ success: true, data: college });
});

const update = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: await collegeService.updateCollege(req.params.id, req.body || {}) });
});

const addCs = catchAsync(async (req, res) => {
  res.status(201).json({ success: true, data: await collegeService.addCsAccount(req.params.id, req.body || {}) });
});

const setCsActive = catchAsync(async (req, res) => {
  const active = Boolean(req.body && req.body.active);
  res.status(200).json({ success: true, data: await collegeService.setCsActive(req.params.id, req.params.userId, active) });
});

const resetCsPassword = catchAsync(async (req, res) => {
  await collegeService.resetCsPassword(req.params.id, req.params.userId, req.body && req.body.password);
  res.status(200).json({ success: true, message: "Password reset" });
});

module.exports = { list, getById, create, update, addCs, setCsActive, resetCsPassword };
