const AppError = require("../../shared/utils/AppError");
const examGroupRepo = require("./examGroup.repository");
const examScheduleRepo = require("./examSchedule.repository");
const examRoomRepo = require("./examRoom.repository");
const examDeletionService = require("../exam-cleanup/services/examDeletionService");

const createSchedule = async (data) => {
  const group = await examGroupRepo.findById(data.examGroup);
  if (!group) throw new AppError("Exam group not found", 404);

  // Validate time range
  if (data.endTime <= data.startTime) {
    throw new AppError("End time must be after start time", 400);
  }

  // Validate date is within group range
  const schedDate = new Date(data.date);
  if (schedDate < group.startDate || schedDate > group.endDate) {
    throw new AppError("Schedule date must be within exam group date range", 400);
  }

  return examScheduleRepo.create(data);
};

const getSchedulesByGroup = async (examGroupId) => {
  return examScheduleRepo.findByExamGroup(examGroupId);
};

// Delegates to the centralized cascade. Releases all duties tied to this
// schedule (or any of its exam-rooms), cancels open change requests,
// notifies teachers, audits — atomically.
const deleteSchedule = async (id, actor = {}) => {
  return examDeletionService.deleteScheduleWithCleanup(id, actor);
};

/**
 * The live SEE schedule of `semester` at exactly this date + start + end, from
 * any department — including one persisted earlier in the same (transactional)
 * batch. Departments sitting together share it, so RS chunks and DCS sizing
 * cover all their rooms (6 × 60 students in 12 rooms → 3 RS, 2 DCS) while each
 * keeps its own exam card. Different semesters never share.
 */
const findSharedSeeSitting = async ({ date, startTime, endTime }, semester, session) => {
  const groupIds = await examGroupRepo.findIdsByTypeAndSemester("SEE", semester, session);
  if (groupIds.length === 0) return null;
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return examScheduleRepo.findSittingOfGroups({ groupIds, dayStart, dayEnd, startTime, endTime }, session);
};

/** `examGroupId` joins the shared sitting `scheduleId`. */
const joinSharedSitting = (scheduleId, examGroupId, session) =>
  examScheduleRepo.addSharedMember(scheduleId, examGroupId, session);

module.exports = {
  findSharedSeeSitting,
  joinSharedSitting,
  createSchedule,
  getSchedulesByGroup,
  deleteSchedule,
};
