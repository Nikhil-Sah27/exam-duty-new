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

/** The caller's live upcoming duty units, all roles — the mobile app's alarm source. */
const getMyUnits = catchAsync(async (req, res) => {
  const units = await dutyService.getMyUpcomingUnits(req.user.id);
  res.status(200).json({ success: true, count: units.length, data: units });
});

const getById = catchAsync(async (req, res) => {
  const duty = await dutyService.getDutyById(req.params.id);
  res.status(200).json({ success: true, data: duty });
});

const cancel = catchAsync(async (req, res) => {
  const duty = await dutyService.cancelDuty(req.params.id, req.body.reason, {
    id: req.user.id,
    activeRole: req.user.activeRole,
  });
  auditService.logSafe({
    action: req.user.activeRole === "cs" ? "ADMIN_UNASSIGN_DUTY" : "CANCEL_DUTY",
    entity: "Duty",
    entityId: duty._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, reason: req.body.reason || null, ...dutySnapshot(duty) },
  });
  res.status(200).json({ success: true, data: duty });
});

const adminUnassignGroup = catchAsync(async (req, res) => {
  const result = await dutyService.adminUnassignDutyGroup(req.body?.dutyId, req.body?.reason, {
    id: req.user.id,
    activeRole: req.user.activeRole,
  });
  const first = result.duties[0];
  auditService.logSafe({
    action: "ADMIN_UNASSIGN_DUTY_GROUP",
    entity: "Duty",
    entityId: first?._id || null,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      teacher: first?.teacher?._id || first?.teacher,
      role: result.role,
      date: first?.date,
      startTime: first?.startTime,
      endTime: first?.endTime,
      roomCount: result.count,
      rooms: result.duties.map((d) => d.room),
      reason: req.body?.reason || null,
    },
  });
  res.status(200).json({ success: true, count: result.count, data: { role: result.role } });
});

/** Teacher confirms their own duty from the app. */
const confirm = catchAsync(async (req, res) => {
  const result = await dutyService.confirmDutyUnit(req.params.id, { teacherId: req.user.id, via: "app" });
  res.status(200).json({
    success: true,
    data: { confirmed: result.confirmed, alreadyConfirmed: result.alreadyConfirmed },
  });
});

const confirmPage = (ok, heading, body) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading} · Proctavo</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
<div style="max-width:420px;margin:12vh auto;padding:32px 28px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;text-align:center;">
<div style="font-size:40px;line-height:1;color:${ok ? "#16a34a" : "#dc2626"};">${ok ? "&#10003;" : "!"}</div>
<h1 style="font-size:20px;color:#1f2937;margin:14px 0 8px;">${heading}</h1>
<p style="font-size:15px;color:#4b5563;line-height:1.5;margin:0 0 20px;">${body}</p>
<a href="${(process.env.APP_URL || "https://proctavo.com").replace(/\/$/, "")}/" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Open Proctavo</a>
</div></body></html>`;

/**
 * One-click confirmation from a duty email (no login — the signed token is the
 * credential). Renders a tiny HTML page instead of JSON: this is opened in a
 * browser, not called by the app. Errors are rendered too, never thrown to the
 * JSON error handler.
 */
const confirmByToken = async (req, res) => {
  try {
    const result = await dutyService.confirmDutyByToken(req.params.token);
    res
      .status(200)
      .type("html")
      .send(
        confirmPage(
          true,
          result.alreadyConfirmed ? "Already confirmed" : "Duty confirmed",
          "Thanks — CS can see you'll be there. You'll still get reminders before the duty."
        )
      );
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .type("html")
      .send(confirmPage(false, "Couldn't confirm", String(err.message || "Something went wrong").replace(/</g, "&lt;")));
  }
};

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
  getMyUnits,
  getById,
  cancel,
  confirm,
  confirmByToken,
  adminUnassignGroup,
  invigilatorsForRooms,
};
