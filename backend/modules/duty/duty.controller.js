const dutyService = require("./duty.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

// Compact who/where/when snapshot for the audit trail — captured at write time
// so the log stays readable even if the duty is later cancelled or deleted.
const dutySnapshot = (d) => ({
  teacher: d.teacher?._id || d.teacher,
  role: d.role,
  room: d.room,
  date: d.date,
  startTime: d.startTime,
  endTime: d.endTime,
});

const selfAssign = catchAsync(async (req, res) => {
  const duty = await dutyService.selfAssignDuty(req.body, req.user.id, req.user.activeRole);
  auditService.logSafe({
    action: "SELF_ASSIGN_DUTY",
    entity: "Duty",
    entityId: duty._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, ...dutySnapshot(duty) },
  });
  res.status(201).json({ success: true, data: duty });
});

const selfAssignGroup = catchAsync(async (req, res) => {
  const duties = await dutyService.selfAssignDutyGroup(req.body, req.user.id, req.user.activeRole);
  auditService.logSafe({
    action: "SELF_ASSIGN_DUTY_GROUP",
    entity: "Duty",
    entityId: duties[0]?._id || null,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      role: duties[0]?.role,
      date: duties[0]?.date,
      startTime: duties[0]?.startTime,
      endTime: duties[0]?.endTime,
      roomCount: duties.length,
      rooms: duties.map((d) => d.room),
    },
  });
  res.status(201).json({ success: true, count: duties.length, data: duties });
});

const adminAssign = catchAsync(async (req, res) => {
  const duty = await dutyService.adminAssignDuty(req.body, req.user.id);
  auditService.logSafe({
    action: "ADMIN_ASSIGN_DUTY",
    entity: "Duty",
    entityId: duty._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, ...dutySnapshot(duty) },
  });
  res.status(201).json({ success: true, data: duty });
});

const adminAssignGroup = catchAsync(async (req, res) => {
  const duties = await dutyService.adminAssignDutyGroup(req.body, req.user.id);
  auditService.logSafe({
    action: "ADMIN_ASSIGN_DUTY_GROUP",
    entity: "Duty",
    entityId: duties[0]?._id || null,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      teacher: duties[0]?.teacher?._id || duties[0]?.teacher,
      role: duties[0]?.role,
      date: duties[0]?.date,
      startTime: duties[0]?.startTime,
      endTime: duties[0]?.endTime,
      roomCount: duties.length,
      rooms: duties.map((d) => d.room),
    },
  });
  res.status(201).json({ success: true, count: duties.length, data: duties });
});

const getAll = catchAsync(async (req, res) => {
  const duties = await dutyService.getAllDuties(req.query);
  res.status(200).json({ success: true, count: duties.length, data: duties });
});

const getById = catchAsync(async (req, res) => {
  const duty = await dutyService.getDutyById(req.params.id);
  res.status(200).json({ success: true, data: duty });
});

const cancel = catchAsync(async (req, res) => {
  const duty = await dutyService.cancelDuty(req.params.id, req.body.reason);
  auditService.logSafe({
    action: "CANCEL_DUTY",
    entity: "Duty",
    entityId: duty._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, reason: req.body.reason || null, ...dutySnapshot(duty) },
  });
  res.status(200).json({ success: true, data: duty });
});

const invigilatorsForRooms = catchAsync(async (req, res) => {
  const data = await dutyService.getInvigilatorsForRooms(req.body?.examRoomIds);
  res.status(200).json({ success: true, count: data.length, data });
});

module.exports = {
  selfAssign,
  selfAssignGroup,
  adminAssign,
  adminAssignGroup,
  getAll,
  getById,
  cancel,
  invigilatorsForRooms,
};
