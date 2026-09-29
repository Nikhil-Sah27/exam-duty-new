const cieService = require("./cie.service");
const auditService = require("../audit/audit.service");
const catchAsync = require("../../shared/utils/catchAsync");

const getDepartmentsData = catchAsync(async (req, res) => {
  const { departmentIds, semester } = req.query;
  const ids = departmentIds ? departmentIds.split(",") : [];
  const data = await cieService.getDepartmentsData(ids, semester);
  res.status(200).json({ success: true, data });
});

const calculateDates = catchAsync(async (req, res) => {
  const result = cieService.calculateDates(req.body);
  res.status(200).json({ success: true, data: result });
});

const createPlan = catchAsync(async (req, res) => {
  const plan = await cieService.createPlan(req.body, req.user.id);
  res.status(201).json({ success: true, data: plan });
});

const assignRooms = catchAsync(async (req, res) => {
  const rooms = await cieService.assignRooms(req.body);
  res.status(201).json({ success: true, data: rooms });
});

const getRooms = catchAsync(async (req, res) => {
  const rooms = await cieService.getRoomsGrouped();
  res.status(200).json({ success: true, data: rooms });
});

// Single-call transactional finalize — replaces the old plan+assign two-step.
const finalize = catchAsync(async (req, res) => {
  const result = await cieService.finalizeCIEPlan(req.body, req.user.id);
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

module.exports = {
  getDepartmentsData,
  calculateDates,
  createPlan,
  assignRooms,
  getRooms,
  finalize,
};
