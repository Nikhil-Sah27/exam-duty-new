const seeService = require("./see.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const createPlan = catchAsync(async (req, res) => {
  const plan = await seeService.createSEEPlan(req.body, req.user.id);
  res.status(201).json({ success: true, data: plan });
});

// Single-call transactional finalize — replaces the old plan+assign two-step.
const finalize = catchAsync(async (req, res) => {
  const result = await seeService.finalizeSEEPlan(req.body, req.user.id);
  auditService.logSafe({
    action: "CREATE_EXAM",
    entity: "ExamGroup",
    entityId: result._id,
    performedBy: req.user.id,
    ipAddress: req.ip,
    details: {
      actorRole: req.user.activeRole,
      examType: result.examType,
      semester: result.semester,
      schedulesCreated: result.schedulesCreated,
      roomsCreated: result.roomsCreated,
    },
  });
  res.status(201).json({ success: true, data: result });
});

module.exports = { createPlan, finalize };
