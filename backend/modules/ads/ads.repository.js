const AdSettings = require("./adSettings.model");
const AdNudge = require("./adNudge.model");

const PLATFORM = { key: "platform" };

const getSettings = () => AdSettings.findOne(PLATFORM).lean();

const setSettings = (data) =>
  AdSettings.findOneAndUpdate(PLATFORM, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();

/** Start (or keep) a teacher's "behind" clock, refreshing what's left to pick. */
const markBehind = (teacherId, remaining) =>
  AdNudge.findOneAndUpdate(
    { teacher: teacherId },
    { $set: { remaining }, $setOnInsert: { behindSince: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

const clearBehind = (teacherId) => AdNudge.deleteOne({ teacher: teacherId });

/**
 * Make the college's records match `behind` (Map teacherId → remaining): stop
 * the clock for everyone else, start or refresh it for these. One upsert per
 * teacher rather than bulkWrite, which would skip the tenancy plugin.
 */
const replaceBehind = async (behind) => {
  const ids = [...behind.keys()];
  await AdNudge.deleteMany({ teacher: { $nin: ids } });
  await Promise.all(ids.map((id) => markBehind(id, behind.get(id))));
};

module.exports = { getSettings, setSettings, markBehind, clearBehind, replaceBehind };
