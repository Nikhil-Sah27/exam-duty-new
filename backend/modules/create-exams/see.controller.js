const seeService = require("./see.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const createPlan = catchAsync(async (req, res) => {
  const plan = await seeService.createSEEPlan(req.body, req.user.id);
  res.status(201).json({ success: true, data: plan });
});

// Single-call transactional finalize — creates one ExamGroup per department.
// Returns an array of created group summaries (one card each).
const finalize = catchAsync(async (req, res) => {
  const results = await seeService.finalizeSEEPlan(req.body, req.user.id);
  for (const result of results) {
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
        departmentCode: result.departmentCode,
        schedulesCreated: result.schedulesCreated,
        roomsCreated: result.roomsCreated,
      },
    });
  }
  res.status(201).json({ success: true, data: results });
});

module.exports = { createPlan, finalize };
