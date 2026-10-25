// The one shape of a room duty created for a teacher who already holds the
// group it joins — rooms added to their RS/DCS group when SEE departments
// regroup (dcsGroup.service.syncGroupsForSchedule, duty.service.syncRsGroupsForSchedule).
// It takes the standing of the group's other duties: who assigned it, and
// whether the teacher already confirmed it. Pure — callers write it.

const roomDutyFromTemplate = ({ schedule, examRoom, teacher, role, template }) => ({
  exam: null,
  examSchedule: schedule._id,
  examRoom: examRoom._id,
  teacher,
  role,
  room: examRoom.room?.roomNumber || "",
  roomRef: examRoom.room?._id || null,
  date: schedule.date,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  assignedBy: template?.assignedBy || teacher,
  isSelfAssigned: template?.isSelfAssigned || false,
  confirmedAt: template?.confirmedAt || null,
  confirmedVia: template?.confirmedVia || null,
});

module.exports = { roomDutyFromTemplate };
