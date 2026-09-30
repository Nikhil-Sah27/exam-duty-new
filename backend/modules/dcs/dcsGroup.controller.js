const dcsGroupService = require("./dcsGroup.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const listGroups = catchAsync(async (req, res) => {
  const groups = await dcsGroupService.listGroups(req.query);
  res.status(200).json({ success: true, count: groups.length, data: groups });
});

const getMine = catchAsync(async (req, res) => {
  const groups = await dcsGroupService.getMyGroups(req.user.id);
  res.status(200).json({ success: true, count: groups.length, data: groups });
});

const getById = catchAsync(async (req, res) => {
  const group = await dcsGroupService.getGroupById(req.params.id);
  res.status(200).json({ success: true, data: group });
});

const claim = catchAsync(async (req, res) => {
  const result = await dcsGroupService.claimGroup(req.params.id, req.user.id);
  auditService.logSafe({
    action: "CLAIM_DCS_GROUP",
    entity: "DCSGroup",
    entityId: result.group?._id || req.params.id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, dutyCount: result.dutyIds?.length || 0 },
  });
  res.status(200).json({
    success: true,
    data: result.group,
    duties: result.dutyIds,
  });
});

const adminClaim = catchAsync(async (req, res) => {
  const result = await dcsGroupService.adminClaimGroup(
    req.params.id,
    req.body?.teacher,
    req.user.id,
  );
  auditService.logSafe({
    action: "ADMIN_CLAIM_DCS_GROUP",
    entity: "DCSGroup",
    entityId: result.group?._id || req.params.id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      teacher: req.body?.teacher,
      dutyCount: result.dutyIds?.length || 0,
    },
  });
  res.status(200).json({
    success: true,
    data: result.group,
    duties: result.dutyIds,
  });
});

const release = catchAsync(async (req, res) => {
  const group = await dcsGroupService.releaseGroup(
    req.params.id,
    { id: req.user.id, activeRole: req.user.activeRole },
    req.body?.reason
  );
  auditService.logSafe({
    action: req.user.activeRole === "cs" ? "ADMIN_UNASSIGN_DUTY_GROUP" : "RELEASE_DCS_GROUP",
    entity: "DCSGroup",
    entityId: group?._id || req.params.id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, reason: req.body?.reason || null },
  });
  res.status(200).json({ success: true, data: group });
});

const getRoomInvigilators = catchAsync(async (req, res) => {
  const data = await dcsGroupService.getRoomInvigilators(req.params.id);
  res.status(200).json({ success: true, data });
});

module.exports = {
  listGroups,
  getMine,
  getById,
  claim,
  adminClaim,
  release,
  getRoomInvigilators,
};
