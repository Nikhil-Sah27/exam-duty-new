import type { ScheduleCourse } from "@/modules/exams/types";

// When multiple ScheduleCourse rows share the same electiveGroupId within one
// (schedule × department), they represent the same scheduled entity — an
// elective group — and should collapse into a single card. This util is the
// single source of truth for that grouping logic.

export type GroupedScheduleEntry =
  | { kind: "course"; course: ScheduleCourse }
  | {
      kind: "group";
      groupId: string;
      groupName: string;
      departmentCode: string | null;
      departmentName: string | null;
      members: ScheduleCourse[];
    };

// Group by (departmentCode, electiveGroupId). Preserves input ordering for
// non-group entries; group entries land at the position of their first member.
export function groupScheduleCourses(
  rows: ScheduleCourse[]
): GroupedScheduleEntry[] {
  const result: GroupedScheduleEntry[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const row of rows) {
    if (row.electiveGroupId) {
      const key = `${row.departmentCode || ""}:${row.electiveGroupId}`;
      const idx = groupIndexByKey.get(key);
      if (idx !== undefined) {
        (result[idx] as Extract<GroupedScheduleEntry, { kind: "group" }>).members.push(row);
        continue;
      }
      groupIndexByKey.set(key, result.length);
      result.push({
        kind: "group",
        groupId: row.electiveGroupId,
        groupName: row.electiveGroupName || "Electives",
        departmentCode: row.departmentCode,
        departmentName: row.departmentName,
        members: [row],
      });
    } else {
      result.push({ kind: "course", course: row });
    }
  }

  return result;
}
