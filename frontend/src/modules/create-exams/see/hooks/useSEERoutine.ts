import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSEEDepartmentsData } from "../services/seeExamService";
import type { DepartmentData } from "../types";
import type { SEERoutineEntry } from "../types";
import {
  validateScheduleEntry,
  getScheduledCourseIds,
} from "../utils/seeValidationUtils";

let _localIdCounter = 0;
const nextLocalId = () => `see-${Date.now()}-${++_localIdCounter}`;

export interface AddEntryInput {
  courseId: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Drives the multi-department SEE routine builder. The CS picks one or more
 * departments + a semester, then schedules courses for each department
 * independently. Every routine entry is tagged with its owning department so
 * the room-assignment and finalize steps keep CSE's courses/rooms entirely
 * separate from ME's — one exam card is created per department.
 */
export function useSEERoutine() {
  // Config (multiple departments + single semester)
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [semester, setSemester] = useState<string>("");

  // Active routine across every selected department.
  const [routine, setRoutine] = useState<SEERoutineEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Per-department form feedback (each department has its own scheduling card).
  const [feedbackByDept, setFeedbackByDept] = useState<Record<string, string | null>>({});

  // Department data + courses — one entry per selected department.
  const stableKey = useMemo(() => [...departmentIds].sort().join(","), [departmentIds]);
  const deptDataQuery = useQuery({
    queryKey: ["see", "departments-data", stableKey, semester],
    queryFn: () => fetchSEEDepartmentsData(departmentIds, semester),
    enabled: departmentIds.length > 0 && Boolean(semester),
  });

  const departmentsData: DepartmentData[] = useMemo(
    () => deptDataQuery.data ?? [],
    [deptDataQuery.data],
  );

  const departmentById = useMemo(() => {
    const map = new Map<string, DepartmentData>();
    for (const d of departmentsData) map.set(d._id, d);
    return map;
  }, [departmentsData]);

  // Routine grouped by department, each list sorted by date then start time.
  const routineByDept = useMemo(() => {
    const map = new Map<string, SEERoutineEntry[]>();
    for (const id of departmentIds) map.set(id, []);
    for (const entry of routine) {
      if (!map.has(entry.departmentId)) map.set(entry.departmentId, []);
      map.get(entry.departmentId)!.push(entry);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return map;
  }, [routine, departmentIds]);

  // Courses already scheduled per department — disabled in that dept's dropdowns.
  const scheduledCourseIdsByDept = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const id of departmentIds) {
      map.set(id, getScheduledCourseIds(routineByDept.get(id) ?? []));
    }
    return map;
  }, [routineByDept, departmentIds]);

  const resetRoutine = useCallback(() => {
    setRoutine([]);
    setEditingId(null);
    setFeedbackByDept({});
  }, []);

  const setDepartments = useCallback(
    (ids: string[]) => {
      setDepartmentIds(ids);
      // Changing the department set invalidates the in-progress routine.
      resetRoutine();
    },
    [resetRoutine],
  );

  const setSemesterConfig = useCallback(
    (sem: string) => {
      setSemester(sem);
      resetRoutine();
    },
    [resetRoutine],
  );

  const tryAddEntry = useCallback(
    (departmentId: string, input: AddEntryInput) => {
      setFeedbackByDept((prev) => ({ ...prev, [departmentId]: null }));

      const deptRoutine = routineByDept.get(departmentId) ?? [];
      // Overlap/duplicate checks are per-department: two departments may sit
      // exams in the same slot (different rooms) without conflict.
      const result = validateScheduleEntry(input, deptRoutine, editingId);
      if (!result.ok) {
        setFeedbackByDept((prev) => ({
          ...prev,
          [departmentId]: result.reason ?? "Cannot add this entry.",
        }));
        return false;
      }

      const department = departmentById.get(departmentId);
      const course = department?.courses.find((c) => c._id === input.courseId);
      if (!department || !course) {
        setFeedbackByDept((prev) => ({
          ...prev,
          [departmentId]: "Selected course is no longer available.",
        }));
        return false;
      }

      const entry: SEERoutineEntry = {
        localId: editingId ?? nextLocalId(),
        departmentId,
        departmentCode: department.code,
        courseId: course._id,
        courseCode: course.code,
        courseTitle: course.name,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
      };

      setRoutine((prev) => {
        if (editingId) {
          return prev.map((r) => (r.localId === editingId ? entry : r));
        }
        return [...prev, entry];
      });
      setEditingId(null);
      return true;
    },
    [routineByDept, editingId, departmentById],
  );

  const removeEntry = useCallback((localId: string) => {
    setRoutine((prev) => prev.filter((r) => r.localId !== localId));
    setEditingId((prev) => (prev === localId ? null : prev));
  }, []);

  const startEdit = useCallback((localId: string) => {
    setEditingId(localId);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const editingEntry = useMemo(
    () => (editingId ? routine.find((r) => r.localId === editingId) ?? null : null),
    [editingId, routine],
  );

  // Deferred-write: finishing the routine just transitions the page into the
  // room-assignment phase. Each selected department must have at least one
  // scheduled course before we can proceed.
  const canFinish = useMemo(() => {
    if (departmentIds.length === 0 || !semester) return false;
    return departmentIds.every((id) => (routineByDept.get(id)?.length ?? 0) > 0);
  }, [departmentIds, semester, routineByDept]);

  return {
    // config
    departmentIds,
    semester,
    setDepartments,
    setSemester: setSemesterConfig,

    // course catalog
    departmentsData,
    departmentById,
    isLoadingCourses: deptDataQuery.isLoading,
    coursesError: deptDataQuery.error,

    // routine
    routine,
    routineByDept,
    scheduledCourseIdsByDept,
    editingId,
    editingEntry,
    feedbackByDept,
    tryAddEntry,
    removeEntry,
    startEdit,
    cancelEdit,

    canFinish,
  };
}
