import type { AssigneePublic } from "@/modules/exams/types";

export interface DutyGroupSummary {
  kind: "DCS" | "RS";
  title: string;
  groupIndex?: number;
  /** Human total such as "1/4" for DCS; omitted for RS. */
  groupTotal?: string;
  buildingName: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: Array<{
    examRoomId: string;
    roomNumber: string;
    floor?: number;
    /** Always supplied so the chip can render "{Block} · {Room}" — required
     *  per spec to disambiguate rooms whose numbers repeat across buildings. */
    buildingName: string;
  }>;
  departments: string[];
  studentCount?: number;
  capacity?: number;
  /** Who currently owns the group, if anyone. */
  assignedTo?: AssigneePublic | null;
  /** True when the viewer themselves own this group. */
  isMine?: boolean;
  /** True when somebody else owns it (occupied / cannot select). */
  isOccupied?: boolean;
}
