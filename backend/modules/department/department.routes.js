const express = require("express");
const c = require("./department.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);
// Teachers only read here; every write is CS-only.

// Department CRUD
router.post("/", requireRole("cs"), c.create);
router.get("/", c.getAll);
router.patch("/:id", requireRole("cs"), c.update);
router.delete("/:id", requireRole("cs"), c.remove);
router.get("/:id/stats", c.getStats);

// Semesters
router.get("/:departmentId/semesters", c.getSemesters);
router.post("/semesters", requireRole("cs"), c.createSemester);
router.patch("/semesters/:id", requireRole("cs"), c.updateSemester);
router.delete("/semesters/:id", requireRole("cs"), c.deleteSemester);

// Elective Groups
router.get("/semesters/:semesterId/elective-groups", c.getElectiveGroups);
router.post("/elective-groups", requireRole("cs"), c.createElectiveGroup);
router.patch("/elective-groups/:id", requireRole("cs"), c.updateElectiveGroup);
router.delete("/elective-groups/:id", requireRole("cs"), c.deleteElectiveGroup);

// Courses
router.get("/semesters/:semesterId/courses", c.getCourses);
router.post("/courses", requireRole("cs"), c.createCourse);
router.patch("/courses/:id", requireRole("cs"), c.updateCourse);
router.delete("/courses/:id", requireRole("cs"), c.deleteCourse);

module.exports = router;
