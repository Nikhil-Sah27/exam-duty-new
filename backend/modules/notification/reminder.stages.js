// When duty reminders go out — the single definition, read by the reminder job
// (reminder.jobs.js), the reminder wording (notification.templates.js), the
// phone-push expiry (push.dispatcher.js) and the calendar-invite alarms
// (calendar.ics.js: `ical` trigger + `alarmText`). Plain data, no imports, so anything
// can require it without a cycle.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Longest lead first. A stage is sent inside [start - lead, start - nextLead):
// once the next stage's moment has arrived, the earlier one is stale.
const STAGES = [
  { id: "3d", lead: 3 * DAY, ical: "-P3D", alarmText: "Exam duty in 3 days" },
  { id: "1d", lead: 1 * DAY, ical: "-P1D", alarmText: "Exam duty tomorrow" },
  { id: "2h", lead: 2 * HOUR, ical: "-PT2H", alarmText: "Exam duty in 2 hours" },
];

// The last stage is the "starting soon" one. "30m" was the last stage before
// it moved to 2h — kept so reminders stored back then still read the same.
const LAST_STAGE_IDS = new Set([STAGES[STAGES.length - 1].id, "30m"]);
const isLastStage = (stageId) => LAST_STAGE_IDS.has(stageId);

/** Push lifetime: a last-stage reminder delivered after its lead is noise. */
const pushTtlSeconds = (stageId) => {
  const stage = STAGES.find((s) => s.id === stageId);
  return isLastStage(stageId) && stage ? stage.lead / 1000 : null;
};

module.exports = { STAGES, isLastStage, pushTtlSeconds, MIN, HOUR, DAY };
