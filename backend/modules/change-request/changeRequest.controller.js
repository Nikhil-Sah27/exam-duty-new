const changeRequestService = require("./changeRequest.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const submit = catchAsync(async (req, res) => {
  const request = await changeRequestService.submitRequest(req.body, req.user.id);
  auditService.logSafe({
    action: "SUBMIT_CHANGE_REQUEST",
    entity: "ChangeRequest",
    entityId: request._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: { actorRole: req.user.activeRole, type: request.type, scope: request.scope },
  });
  res.status(201).json({ success: true, data: request });
});

const getAll = catchAsync(async (req, res) => {
  const requests = await changeRequestService.getAllRequests(req.query);
  res.status(200).json({ success: true, count: requests.length, data: requests });
});

const getById = catchAsync(async (req, res) => {
  const request = await changeRequestService.getRequestById(req.params.id);
  res.status(200).json({ success: true, data: request });
});

const getMine = catchAsync(async (req, res) => {
  const requests = await changeRequestService.getMyRequests(req.user.id);
  res.status(200).json({ success: true, count: requests.length, data: requests });
});

const approve = catchAsync(async (req, res) => {
  const request = await changeRequestService.approveRequest(
    req.params.id, req.user.id, req.body.note
  );
  auditService.logSafe({
    action: "APPROVE_CHANGE_REQUEST",
    entity: "ChangeRequest",
    entityId: request._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      type: request.type,
      scope: request.scope,
      requestedBy: request.requestedBy?._id || request.requestedBy,
      note: req.body.note || null,
    },
  });
  res.status(200).json({ success: true, data: request });
});

const reject = catchAsync(async (req, res) => {
  const request = await changeRequestService.rejectRequest(
    req.params.id, req.user.id, req.body.note
  );
  auditService.logSafe({
    action: "REJECT_CHANGE_REQUEST",
    entity: "ChangeRequest",
    entityId: request._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      type: request.type,
      scope: request.scope,
      requestedBy: request.requestedBy?._id || request.requestedBy,
      note: req.body.note || null,
    },
  });
  res.status(200).json({ success: true, data: request });
});

const remove = catchAsync(async (req, res) => {
  const request = await changeRequestService.deleteRequest(req.params.id);
  auditService.logSafe({
    action: "DELETE_CHANGE_REQUEST",
    entity: "ChangeRequest",
    entityId: request._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      type: request.type,
      scope: request.scope,
      status: request.status,
      requestedBy: request.requestedBy?._id || request.requestedBy,
      requestedByName: request.requestedBy?.name || null,
    },
  });
  res.status(200).json({ success: true, data: { _id: request._id } });
});

const getReplacements = catchAsync(async (req, res) => {
  const slots = await changeRequestService.getAvailableReplacements(
    req.params.dutyId,
    req.user.id
  );
  res.status(200).json({ success: true, count: slots.length, data: slots });
});

module.exports = { submit, getAll, getById, getMine, approve, reject, remove, getReplacements };
