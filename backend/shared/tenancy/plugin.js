/**
 * `collegeScoped` — the fence between colleges (MULTI_COLLEGE_PLAN.md §3.2).
 *
 * Attach to every college-owned schema (`schema.plugin(collegeScoped, …)`). It
 * adds a `college` field and, like the soft-delete pre-find hooks, applies the
 * current scope (context.js) to every operation without call sites knowing:
 *
 *   - reads, updates and deletes get `college = <current>` added;
 *   - aggregates get a leading `$match` on it;
 *   - new documents (save / create / insertMany) are stamped with it.
 *
 * Fail-closed: with no scope at all, every operation throws. The platform scope
 * opts out of the filter on purpose; there, a new document must already name
 * its college (except where `optional` allows none — the superadmin user).
 *
 * Exam-type switches (features.js): with `examTypeFilter`, listings — reads
 * that aren't lookups by `_id` — also skip exam types the college has turned
 * off. Lookups by id (findById, populate) still resolve, so a hidden exam never
 * turns a reference into a null that crashes the page holding it. Writes are
 * never feature-filtered. `examTypeFrom` denormalises the type onto documents
 * that only point at their exam ("examGroup" or "examSchedule"), stamped on
 * creation and backfilled by the college migration.
 */
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");
const { currentScope } = require("./context");
const { FEATURES, featureForExamType } = require("./features");

const { ObjectId } = mongoose.Types;

const EXAM_TYPES = ["IA1", "IA2", "IA3", "SEE"];

const QUERY_HOOKS = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
];
const READ_OPS = new Set(["find", "findOne", "countDocuments", "distinct"]);

const scopeOrThrow = (modelName, op) => {
  const scope = currentScope();
  if (!scope) {
    throw new Error(`[tenancy] ${modelName}.${op} ran outside a college scope — wrap it in runAsCollege/runAsPlatform`);
  }
  return scope;
};

const targetsIds = (filter) => Boolean(filter && Object.prototype.hasOwnProperty.call(filter, "_id"));

// ── exam type lookup for documents that only reference their exam ───────────
const examTypesFor = async (from, ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const ExamGroup = mongoose.model("ExamGroup");
  let groupOf = new Map(unique.map((id) => [id, id]));
  if (from === "examSchedule") {
    const schedules = await mongoose.model("ExamSchedule").find({ _id: { $in: unique } }).select("examGroup").lean();
    groupOf = new Map(schedules.map((s) => [String(s._id), s.examGroup && String(s.examGroup)]));
  }
  const groups = await ExamGroup.find({ _id: { $in: [...new Set([...groupOf.values()].filter(Boolean))] } })
    .select("examType")
    .lean();
  const typeOfGroup = new Map(groups.map((g) => [String(g._id), g.examType]));
  return new Map(unique.map((id) => [id, typeOfGroup.get(groupOf.get(id)) || null]));
};

function collegeScoped(schema, { optional = false, examTypeFilter = false, examTypeFrom = null } = {}) {
  schema.add({
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null, index: true },
  });
  if (examTypeFrom) {
    schema.add({ examType: { type: String, enum: [...EXAM_TYPES, null], default: null, index: true } });
  }
  const filtersExamType = examTypeFilter || Boolean(examTypeFrom);

  // Reads, updates, deletes.
  schema.pre(QUERY_HOOKS, function scopeQuery() {
    const scope = scopeOrThrow(this.model.modelName, this.op);
    if (scope.platform) return;
    this.where({ college: scope.collegeId });
    if (filtersExamType && READ_OPS.has(this.op) && scope.hiddenExamTypes.length && !targetsIds(this.getFilter())) {
      this.and([{ examType: { $nin: scope.hiddenExamTypes } }]);
    }
  });

  schema.pre("aggregate", function scopeAggregate() {
    const scope = scopeOrThrow(this._model.modelName, "aggregate");
    if (scope.platform) return;
    const match = { college: new ObjectId(scope.collegeId) };
    if (filtersExamType && scope.hiddenExamTypes.length) match.examType = { $nin: scope.hiddenExamTypes };
    this.pipeline().unshift({ $match: match });
  });

  // New documents.
  const stamp = (doc, modelName) => {
    const scope = scopeOrThrow(modelName, "create");
    if (scope.platform) {
      if (!doc.college && !optional) throw new Error(`[tenancy] new ${modelName} has no college`);
      return;
    }
    if (doc.college && String(doc.college) !== scope.collegeId) {
      throw new Error(`[tenancy] refusing to create a ${modelName} for another college`);
    }
    doc.college = scope.collegeId;
    // A switched-off exam type can't get new exams, whichever flow creates them.
    if (examTypeFilter && scope.hiddenExamTypes.includes(doc.examType)) {
      const feature = FEATURES[featureForExamType(doc.examType)];
      throw new AppError(`${feature ? feature.label : `${doc.examType} exams`} are turned off for your college`, 403);
    }
  };

  schema.pre("validate", async function stampNew() {
    if (!this.isNew) return;
    stamp(this, this.constructor.modelName);
    if (examTypeFrom && !this.examType && this[examTypeFrom]) {
      const types = await examTypesFor(examTypeFrom, [this[examTypeFrom]]);
      this.examType = types.get(String(this[examTypeFrom])) || null;
    }
  });

  // Callback-style on purpose: model middleware receives the docs after `next`.
  schema.pre("insertMany", function stampMany(next, docs) {
    const list = Array.isArray(docs) ? docs : [docs];
    try {
      for (const doc of list) stamp(doc, this.modelName);
    } catch (err) {
      return next(err);
    }
    const missing = examTypeFrom ? list.filter((d) => !d.examType && d[examTypeFrom]) : [];
    if (!missing.length) return next();
    examTypesFor(examTypeFrom, missing.map((d) => d[examTypeFrom])).then((types) => {
      for (const d of missing) d.examType = types.get(String(d[examTypeFrom])) || null;
      next();
    }, next);
  });
}

module.exports = { collegeScoped, examTypesFor };
