const mongoose = require("mongoose");
const AppError = require("../../shared/utils/AppError");
const repo = require("./department.repository");

// ---------- Department ----------

const createDepartment = async ({ name, code }) => {
  return repo.createDept({ name, code });
};

const getAllDepartments = async () => {
  return repo.findAllDepts();
};

const updateDepartment = async (id, data) => {
  const dept = await repo.updateDept(id, data);
  if (!dept) throw new AppError("Department not found", 404);
  return dept;
};

const deleteDepartment = async (id) => {
  const dept = await repo.deleteDept(id);
  if (!dept) throw new AppError("Department not found", 404);
  return dept;
};

const getDepartmentStats = async (id) => {
  const dept = await repo.findDeptById(id);
  if (!dept) throw new AppError("Department not found", 404);

  const objectId = new mongoose.Types.ObjectId(id);

  const [totalSemesters, totalCourses, totalStudents] = await Promise.all([
    repo.countSemestersByDept(objectId),
    repo.countCoursesByDept(objectId),
    repo.sumStudentsByDept(objectId),
  ]);

  return { totalStudents, totalSemesters, totalCourses };
};

// ---------- Semester ----------

const getSemesters = async (departmentId) => {
  const dept = await repo.findDeptById(departmentId);
  if (!dept) throw new AppError("Department not found", 404);
  return repo.findSemestersByDept(departmentId);
};

const createSemester = async ({ name, department, studentCount }) => {
  const dept = await repo.findDeptById(department);
  if (!dept) throw new AppError("Department not found", 404);
  return repo.createSemester({ name, department, studentCount });
};

const updateSemester = async (id, data) => {
  const semester = await repo.updateSemester(id, data);
  if (!semester) throw new AppError("Semester not found", 404);
  return semester;
};

const deleteSemester = async (id) => {
  const semester = await repo.findSemesterById(id);
  if (!semester) throw new AppError("Semester not found", 404);
  await repo.deleteSemester(id);
};

// ---------- Course ----------

const getCourses = async (semesterId) => {
  const sem = await repo.findSemesterById(semesterId);
  if (!sem) throw new AppError("Semester not found", 404);
  return repo.findCoursesBySemester(semesterId);
};

const createCourse = async ({ name, code, credits, semester, exams, courseType, electiveGroup }) => {
  const sem = await repo.findSemesterById(semester);
  if (!sem) throw new AppError("Semester not found", 404);

  // Validate elective group if provided
  if (electiveGroup) {
    const group = await repo.findElectiveGroupById(electiveGroup);
    if (!group) throw new AppError("Elective group not found", 404);
    if (group.semester.toString() !== semester) {
      throw new AppError("Elective group does not belong to this semester", 400);
    }
  }

  return repo.createCourse({
    name,
    code,
    credits,
    semester,
    exams,
    // A course belonging to an elective group is an "elective"; everything
    // else is "core". No professional/open distinction.
    courseType: electiveGroup ? "elective" : courseType || "core",
    electiveGroup: electiveGroup || null,
  });
};

const updateCourse = async (id, data) => {
  const course = await repo.updateCourse(id, data);
  if (!course) throw new AppError("Course not found", 404);
  return course;
};

const deleteCourse = async (id) => {
  const course = await repo.findCourseById(id);
  if (!course) throw new AppError("Course not found", 404);
  await repo.deleteCourse(id);
};

// ---------- Elective Group ----------

const getElectiveGroups = async (semesterId) => {
  const sem = await repo.findSemesterById(semesterId);
  if (!sem) throw new AppError("Semester not found", 404);

  const groups = await repo.findElectiveGroupsBySemester(semesterId);

  // Attach courses to each group
  const result = [];
  for (const group of groups) {
    const courses = await repo.findCoursesByElectiveGroup(group._id);
    result.push({
      ...group.toObject(),
      courses,
    });
  }

  return result;
};

const createElectiveGroup = async ({ name, semester }) => {
  const sem = await repo.findSemesterById(semester);
  if (!sem) throw new AppError("Semester not found", 404);
  return repo.createElectiveGroup({ name, semester });
};

const updateElectiveGroup = async (id, data) => {
  const group = await repo.updateElectiveGroup(id, data);
  if (!group) throw new AppError("Elective group not found", 404);
  return group;
};

const deleteElectiveGroup = async (id) => {
  const group = await repo.findElectiveGroupById(id);
  if (!group) throw new AppError("Elective group not found", 404);

  // Remove elective group reference from all courses in this group
  const courses = await repo.findCoursesByElectiveGroup(id);
  for (const course of courses) {
    await repo.updateCourse(course._id, {
      courseType: "core",
      electiveGroup: null,
    });
  }

  await repo.deleteElectiveGroup(id);
};

module.exports = {
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
  getSemesters,
  createSemester,
  updateSemester,
  deleteSemester,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getElectiveGroups,
  createElectiveGroup,
  updateElectiveGroup,
  deleteElectiveGroup,
};
