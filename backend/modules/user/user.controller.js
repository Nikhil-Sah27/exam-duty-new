const userService = require("./user.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

// Who is acting — the service uses it to keep CS accounts CS-only.
const actorOf = (req) => ({ id: req.user.id, activeRole: req.user.activeRole });

const userSnapshot = (u) => ({
  name: u?.name,
  email: u?.email,
  designation: u?.designation,
  roles: u?.roles,
  department: u?.department,
});

const create = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body, actorOf(req));
  auditService.logSafe({
    action: "CREATE_USER",
    entity: "User",
    entityId: user._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, ...userSnapshot(user) },
  });
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
  const user = await userService.updateUser(req.params.id, req.body, actorOf(req));
  auditService.logSafe({
    action: "UPDATE_USER",
    entity: "User",
    entityId: user._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      changedFields: Object.keys(req.body || {}),
      ...userSnapshot(user),
    },
  });
  res.status(200).json({ success: true, data: user });
});

const remove = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id, actorOf(req));
  auditService.logSafe({
    action: "DEACTIVATE_USER",
    entity: "User",
    entityId: req.params.id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole },
  });
  res.status(200).json({ success: true, message: "User deactivated" });
});

const activate = catchAsync(async (req, res) => {
  const user = await userService.activateUser(req.params.id, actorOf(req));
  auditService.logSafe({
    action: "REACTIVATE_USER",
    entity: "User",
    entityId: user._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, ...userSnapshot(user) },
  });
  res.status(200).json({ success: true, data: user });
});

const bootstrap = catchAsync(async (req, res) => {
  const user = await userService.bootstrapAdmin();
  res.status(201).json({ success: true, data: user });
});

/** CS bulk-adds teachers from a parsed CSV. `dryRun` validates without creating. */
const importUsers = catchAsync(async (req, res) => {
  const { rows, defaultPassword, dryRun } = req.body || {};
  const result = await userService.importUsers(rows, { defaultPassword, dryRun: Boolean(dryRun) });
  if (!result.dryRun) {
    auditService.logSafe({
      action: "IMPORT_USERS",
      entity: "User",
      performedBy: req.user.id,
      ipAddress: req.ip,
      details: { actorRole: req.user.activeRole, ...result.summary },
    });
  }
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  importUsers, create, getAll, getById, update, remove, activate, bootstrap };
