const Department = require("./department.model");
const Semester = require("./semester.model");
const Course = require("./course.model");
const ElectiveGroup = require("./electiveGroup.model");

// ---------- Department ----------

const createDept = (data) => Department.create(data);

const findAllDepts = () => Department.find({ isActive: true }).sort({ name: 1 });

const findDeptById = (id) => Department.findById(id);

const updateDept = (id, data) =>
  Department.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteDept = (id) =>
  Department.findByIdAndUpdate(id, { isActive: false }, { new: true });

// ---------- Semester ----------

const createSemester = (data) => Semester.create(data);

const findSemestersByDept = (departmentId) =>
  Semester.find({ department: departmentId }).sort({ name: 1 });

const findSemesterById = (id) => Semester.findById(id);

const updateSemester = (id, data) =>
  Semester.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteSemester = (id) => Semester.findByIdAndDelete(id);

// ---------- Course ----------

const createCourse = (data) => Course.create(data);

const findCoursesBySemester = (semesterId) =>
  Course.find({ semester: semesterId })
    .populate("electiveGroup", "name")
    .sort({ courseType: 1, code: 1 });

const findCourseById = (id) => Course.findById(id);

const updateCourse = (id, data) =>
  Course.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteCourse = (id) => Course.findByIdAndDelete(id);

// ---------- Elective Group ----------

const createElectiveGroup = (data) => ElectiveGroup.create(data);

const findElectiveGroupsBySemester = (semesterId) =>
  ElectiveGroup.find({ semester: semesterId }).sort({ name: 1 });

const findElectiveGroupById = (id) => ElectiveGroup.findById(id);

const updateElectiveGroup = (id, data) =>
  ElectiveGroup.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteElectiveGroup = (id) => ElectiveGroup.findByIdAndDelete(id);

const findCoursesByElectiveGroup = (groupId) =>
  Course.find({ electiveGroup: groupId }).sort({ code: 1 });

// Lenient (department, semester-number) match — the stored `name` varies
// ("7", "Sem 7", "Semester 07"), so match the bare number or common prefixes.
const findSemesterByDeptAndNumber = (departmentId, semester) => {
  const semNumber = String(semester);
  const pattern = "^(Sem(ester)?\\s*)?0?" + semNumber + "$";
  return Semester.findOne({
    department: departmentId,
    $or: [
      { name: semNumber },
      { name: { $regex: new RegExp(pattern, "i") } },
    ],
  });
};

const findCoursesByIdsInSemester = (courseIds, semesterId) =>
  Course.find({ _id: { $in: courseIds }, semester: semesterId });

const findActiveDepartmentsByIds = (ids) =>
  Department.find({ _id: { $in: ids }, isActive: true });

// Planning-wizard course list: populated group name, ordered by code only.
// Distinct from findCoursesBySemester (which also sorts by courseType) so the
// Create-Exams wizard keeps its existing ordering.
const findCoursesBySemesterSortedByCode = (semesterId) =>
  Course.find({ semester: semesterId })
    .populate("electiveGroup", "name")
    .sort({ code: 1 });

// ---------- Stats ----------

const countSemestersByDept = (departmentId) =>
  Semester.countDocuments({ department: departmentId });

const countCoursesByDept = async (departmentId) => {
  const semesters = await Semester.find({ department: departmentId }).select("_id");
  const semesterIds = semesters.map((s) => s._id);
  return Course.countDocuments({ semester: { $in: semesterIds } });
};

const sumStudentsByDept = async (departmentId) => {
  const result = await Semester.aggregate([
    { $match: { department: departmentId } },
    { $group: { _id: null, total: { $sum: "$studentCount" } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
};

module.exports = {
  createDept,
  findAllDepts,
  findDeptById,
  updateDept,
  deleteDept,
  createSemester,
  findSemestersByDept,
  findSemesterById,
  updateSemester,
  deleteSemester,
  createCourse,
  findCoursesBySemester,
  findCourseById,
  updateCourse,
  deleteCourse,
  createElectiveGroup,
  findElectiveGroupsBySemester,
  findElectiveGroupById,
  updateElectiveGroup,
  deleteElectiveGroup,
  findCoursesByElectiveGroup,
  findSemesterByDeptAndNumber,
  findCoursesByIdsInSemester,
  findActiveDepartmentsByIds,
  findCoursesBySemesterSortedByCode,
  countSemestersByDept,
  countCoursesByDept,
  sumStudentsByDept,
};
