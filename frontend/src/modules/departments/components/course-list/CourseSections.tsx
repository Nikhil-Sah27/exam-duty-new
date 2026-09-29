import { useState } from "react";
import { Plus, Trash2, Pencil, Inbox, ChevronDown, ChevronRight } from "lucide-react";
import type { Course, ElectiveGroup } from "../../types";
import CourseRow from "./CourseRow";

function ElectiveGroupSection({
  group,
  onEditCourse,
  onDeleteCourse,
  onEditGroup,
  onDeleteGroup,
  onAddCourse,
}: {
  group: ElectiveGroup;
  onEditCourse: (c: Course) => void;
  onDeleteCourse: (id: string) => void;
  onEditGroup: (g: ElectiveGroup) => void;
  onDeleteGroup: (id: string) => void;
  onAddCourse: (groupId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div
        className="flex cursor-pointer items-center gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
        <span className="text-sm font-medium text-gray-700">{group.name}</span>
        <span className="text-xs text-gray-400">
          ({group.courses.length} {group.courses.length === 1 ? "subject" : "subjects"})
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddCourse(group._id);
            }}
            className="rounded p-1 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
            title="Add course to group"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditGroup(group);
            }}
            className="rounded p-1 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
            title="Rename group"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup(group._id);
            }}
            className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
            title="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-1 border-t border-gray-100 px-3 py-2">
          {group.courses.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">No courses in this group yet</p>
          ) : (
            group.courses.map((c) => (
              <CourseRow
                key={c._id}
                course={c}
                onEdit={onEditCourse}
                onDelete={onDeleteCourse}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CoreCoursesSection({
  courses,
  onAdd,
  onEdit,
  onDelete,
}: {
  courses: Course[];
  onAdd: () => void;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-gray-400">Core Courses</span>
        <button
          onClick={() => onAdd()}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <Plus className="h-3 w-3" /> Add Core Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-400">
          <Inbox className="h-4 w-4" /> No core courses yet
        </div>
      ) : (
        <div className="space-y-1">
          {courses.map((c) => (
            <CourseRow key={c._id} course={c} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ElectiveGroupsSection({
  groups,
  onAddGroup,
  onEditCourse,
  onDeleteCourse,
  onEditGroup,
  onDeleteGroup,
  onAddCourse,
}: {
  groups: ElectiveGroup[] | undefined;
  onAddGroup: () => void;
  onEditCourse: (c: Course) => void;
  onDeleteCourse: (id: string) => void;
  onEditGroup: (g: ElectiveGroup) => void;
  onDeleteGroup: (id: string) => void;
  onAddCourse: (groupId: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-gray-400">Elective Groups</span>
        <button
          onClick={() => onAddGroup()}
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800"
        >
          <Plus className="h-3 w-3" /> Add Elective Group
        </button>
      </div>

      {!groups || groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-400">
          <Inbox className="h-4 w-4" /> No elective groups yet
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <ElectiveGroupSection
              key={g._id}
              group={g}
              onEditCourse={onEditCourse}
              onDeleteCourse={onDeleteCourse}
              onEditGroup={onEditGroup}
              onDeleteGroup={onDeleteGroup}
              onAddCourse={onAddCourse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
