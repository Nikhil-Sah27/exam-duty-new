import type {
  DepartmentData,
  SlotAllocation,
  DepartmentAllocation,
} from "../../types";
import type { SEERoutineEntry } from "../types";

/**
 * Build the SlotAllocation[] the CIE room-allocation reducer expects, from a
 * multi-department SEE routine. Each routine entry becomes ONE slot with ONE
 * department allocation (every SEE slot belongs to a single department — that's
 * what keeps CSE's rooms separate from ME's).
 *
 * The `orderedRoutine` must already be grouped department-by-department (all of
 * CSE's entries, then all of ME's) so the room-assignment screen lists one
 * department's exams fully before the next. `shiftIndex` is the entry's index
 * in that ordered list — unique per slot, and the same index the fabricated
 * `shifts` array uses so `shifts[shiftIndex]` resolves to the slot's window.
 *
 * `scheduleId` is the routine entry's `localId` — a synthetic slotKey used
 * across the room-assignment phase; the backend resolves it to a real
 * ExamSchedule._id inside the finalize transaction.
 */
export function buildSEESlotAllocations(
  orderedRoutine: SEERoutineEntry[],
  departmentById: Map<string, DepartmentData>,
  avgStudentsPerClass: number,
): SlotAllocation[] {
  return orderedRoutine.map((entry, idx) => {
    const department = departmentById.get(entry.departmentId);

    const deptAllocation: DepartmentAllocation = {
      departmentId: entry.departmentId,
      departmentCode: entry.departmentCode,
      courseId: entry.courseId,
      courseName: entry.courseTitle,
      students: department?.semester?.studentCount || avgStudentsPerClass,
      assignedRooms: [],
      sharedSeatsReceived: [],
      sharedSeatsGiven: [],
      shareableMark: null,
      globalSharedReceived: [],
    };

    const slot: SlotAllocation = {
      scheduleId: entry.localId,
      date: entry.date,
      shiftIndex: idx,
      shiftName: `${entry.startTime} – ${entry.endTime}`,
      departments: [deptAllocation],
    };

    return slot;
  });
}
