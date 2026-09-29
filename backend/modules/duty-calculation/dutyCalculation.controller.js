const catchAsync = require("../../shared/utils/catchAsync");
const dutyCalculationService = require("./dutyCalculation.service");

/** Progress for the currently-authenticated user. Used by the dashboard widget. */
const getMyProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateTeacherProgress(
    req.user.id
  );
  res.status(200).json({ success: true, data: progress });
});

/** RS progress for the currently-authenticated user. Used by the RS dashboard widget. */
const getMyRsProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateRsTeacherProgress(
    req.user.id
  );
  res.status(200).json({ success: true, data: progress });
});

/** DCS progress for the currently-authenticated user. Used by the DCS dashboard widget. */
const getMyDcsProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateDcsTeacherProgress(
    req.user.id
  );
  res.status(200).json({ success: true, data: progress });
});

/** Progress for a specific teacher — admin analytics + drill-in views. */
const getTeacherProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateTeacherProgress(
    req.params.teacherId
  );
  res.status(200).json({ success: true, data: progress });
});

/** RS progress for a specific teacher — CS assign-RS wizard. */
const getTeacherRsProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateRsTeacherProgress(
    req.params.teacherId
  );
  res.status(200).json({ success: true, data: progress });
});

/** DCS progress for a specific teacher — CS assign-DCS wizard. */
const getTeacherDcsProgress = catchAsync(async (req, res) => {
  const progress = await dutyCalculationService.calculateDcsTeacherProgress(
    req.params.teacherId
  );
  res.status(200).json({ success: true, data: progress });
});

/** Cohort table for the admin analytics page. Supports simple filters. */
const getAllTeachersProgress = catchAsync(async (req, res) => {
  const { role, department, eligibleOnly } = req.query;
  const result = await dutyCalculationService.calculateAllTeachersProgress({
    role,
    department,
    eligibleOnly: eligibleOnly === "true",
  });
  res
    .status(200)
    .json({ success: true, count: result.teachers.length, data: result });
});

/** Institution-wide totals + per-department + per-semester breakdown. */
const getInstitutionSummary = catchAsync(async (req, res) => {
  const snapshot = await dutyCalculationService.recalculateAll();
  res.status(200).json({ success: true, data: snapshot });
});

/** Semester-level detail — powers the Target tooltip on the dashboard. */
const getSemesterBreakdown = catchAsync(async (req, res) => {
  const result = await dutyCalculationService.calculateSemesterDuties(
    req.params.semesterId
  );
  res.status(200).json({ success: true, data: result });
});

/** Department-level detail — for department-level analytics. */
const getDepartmentBreakdown = catchAsync(async (req, res) => {
  const result = await dutyCalculationService.calculateDepartmentDuties(
    req.params.departmentId
  );
  res.status(200).json({ success: true, data: result });
});

/** Force-recompute alias — same shape as `getInstitutionSummary`. */
const recalculateAll = catchAsync(async (req, res) => {
  const snapshot = await dutyCalculationService.recalculateAll();
  res.status(200).json({ success: true, data: snapshot });
});

module.exports = {
  getMyProgress,
  getMyRsProgress,
  getMyDcsProgress,
  getTeacherProgress,
  getTeacherRsProgress,
  getTeacherDcsProgress,
  getAllTeachersProgress,
  getInstitutionSummary,
  getSemesterBreakdown,
  getDepartmentBreakdown,
  recalculateAll,
};
