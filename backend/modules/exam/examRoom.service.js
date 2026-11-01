const AppError = require("../../shared/utils/AppError");
const examScheduleRepo = require("./examSchedule.repository");
const examRoomRepo = require("./examRoom.repository");
const examDeletionService = require("../exam-cleanup/services/examDeletionService");
const roomReservationService = require("./roomReservation.service");

const addRoom = async (data) => {
  const schedule = await examScheduleRepo.findById(data.schedule);
  if (!schedule) throw new AppError("Schedule not found", 404);

  // Global room-reservation check — the physical room must be free for this
  // schedule's exact window across every exam type, semester, and department.
  // No group-level exclusion: even another schedule inside the same exam
  // group is a real conflict if the times overlap.
  await roomReservationService.assertNoConflicts({
    requests: [
      {
        roomId: data.room,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
    ],
  });

  return examRoomRepo.create(data);
};

const getRoomsBySchedule = async (scheduleId) => {
  return examRoomRepo.findBySchedule(scheduleId);
};

// Delegates to the centralized cascade. Releases all duties at this room,
// cancels open change requests, notifies teachers, audits — atomically.
const removeRoom = async (id, actor = {}) => {
  return examDeletionService.deleteExamRoomWithCleanup(id, actor);
};

/** { _id, schedule } of every room in these schedules. */
const listIdsForSchedules = (scheduleIds) =>
  scheduleIds.length ? examRoomRepo.findIdsBySchedules(scheduleIds) : Promise.resolve([]);

module.exports = {
  addRoom,
  listIdsForSchedules,
  getRoomsBySchedule,
  removeRoom,
};
