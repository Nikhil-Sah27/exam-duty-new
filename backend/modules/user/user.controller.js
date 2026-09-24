const userService = require("./user.service");
const catchAsync = require("../../shared/utils/catchAsync");

const create = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, data: user });
});

const getAll = catchAsync(async (req, res) => {
  const users = await userService.getAllUsers(req.query);
  res.status(200).json({ success: true, count: users.length, data: users });
});

const getById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json({ success: true, data: user });
});

const update = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.status(200).json({ success: true, data: user });
});

const remove = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id);
  res.status(200).json({ success: true, message: "User deactivated" });
});

const activate = catchAsync(async (req, res) => {
  const user = await userService.activateUser(req.params.id);
  res.status(200).json({ success: true, data: user });
});

const bootstrap = catchAsync(async (req, res) => {
  const user = await userService.bootstrapAdmin();
  res.status(201).json({ success: true, data: user });
});

module.exports = { create, getAll, getById, update, remove, activate, bootstrap };
