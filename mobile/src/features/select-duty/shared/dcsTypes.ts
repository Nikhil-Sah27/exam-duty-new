// Copied verbatim from frontend/src/modules/dcs/select-duty/types.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

/**
 * Shape of the persisted DCS group the backend returns. Matches the spec's
 * required object: examId, groupId, dcsRequired, assignedRooms[],
 * assignedDepartments[], assignedStudents, assignedTeacher.
 */

export interface DcsRoomLite {
  _id: string;
  departments: string[];
  room: {
    _id: string;
    roomNumber: string;
    floor: number;
    capacity: number;
    building?: { _id: string; name: string };
  };
}

export interface DcsGroupTeacher {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
}

export interface DcsGroup {
  _id: string;
  examGroup: {
    _id: string;
    examType: "IA1" | "IA2" | "IA3" | "SEE";
    semester: number;
    startDate: string;
    endDate: string;
  };
  schedule: {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    examGroup: string;
  };
  groupIndex: number;
  dcsRequired: number;
  assignedRooms: DcsRoomLite[];
  assignedDepartments: string[];
  assignedStudents: number;
  assignedTeacher: DcsGroupTeacher | null;
  /** Duty ids created when the group was claimed — empty while open. */
  duties?: string[];
  status: "open" | "claimed" | "released";
  createdAt: string;
  updatedAt: string;
}

export type DcsGroupState =
  | "AVAILABLE" // group has no assignedTeacher and no time conflict for the viewer
  | "SELECTED" // viewer has this groupId pending in the side panel
  | "OCCUPIED" // claimed by another DCS
  | "MINE"     // claimed by the viewer (shown for context, not selectable)
  | "CONFLICT"; // time overlaps with another selected group or a duty viewer already holds

export interface DcsRoomContact {
  examRoomId: string;
  room: DcsRoomLite["room"];
  departments: string[];
  invigilators: DcsGroupTeacher[];
}

export interface DcsRoomContactsResponse {
  groupId: string;
  rooms: DcsRoomContact[];
}

export interface DcsFilters {
  date: string;
  examType: string;
  department: string;
  semester: string;
}

export const EMPTY_DCS_FILTERS: DcsFilters = {
  date: "",
  examType: "",
  department: "",
  semester: "",
};

export interface DcsSelectionValidation {
  ok: boolean;
  reason?: string;
}
