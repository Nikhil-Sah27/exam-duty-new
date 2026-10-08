/**
 * Per-college feature switches (MULTI_COLLEGE_PLAN.md §3.4). The superadmin
 * turns these on or off per college; a new switch is one entry here plus the
 * checks that honour it.
 *
 * Exam-type switches are special: a college that turns one off doesn't just
 * lose the "create" button — every exam of that type, and every duty in one,
 * disappears from its listings (decision Q2). The tenancy plugin applies that
 * filter automatically from `examTypes` below; nothing is deleted, so turning
 * the switch back on restores everything.
 */
const FEATURES = {
  cie: {
    label: "CIE exams",
    description: "Internal assessments — IA1, IA2, IA3",
    default: true,
    examTypes: ["IA1", "IA2", "IA3"],
  },
  see: {
    label: "SEE exams",
    description: "Semester end examinations",
    default: true,
    examTypes: ["SEE"],
  },
};

const FEATURE_KEYS = Object.keys(FEATURES);

/** A complete switch map: stored values where set, defaults elsewhere. */
const resolveFeatures = (stored = {}) =>
  Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, typeof stored?.[key] === "boolean" ? stored[key] : FEATURES[key].default])
  );

/** Exam types hidden by a college's switches. */
const hiddenExamTypes = (stored) => {
  const on = resolveFeatures(stored);
  return FEATURE_KEYS.filter((key) => !on[key] && FEATURES[key].examTypes).flatMap((key) => FEATURES[key].examTypes);
};

/** The switch that governs an exam type (e.g. "IA2" → "cie"), or null. */
const featureForExamType = (examType) =>
  FEATURE_KEYS.find((key) => (FEATURES[key].examTypes || []).includes(examType)) || null;

module.exports = { FEATURES, FEATURE_KEYS, resolveFeatures, hiddenExamTypes, featureForExamType };
