import { useState, FormEvent } from "react";
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useElectiveGroups,
  useCreateElectiveGroup,
  useUpdateElectiveGroup,
  useDeleteElectiveGroup,
} from "../hooks";
import type { Course, ElectiveGroup } from "../types";
import { ConfirmDeleteModal } from "@/shared/components";
import { CoreCoursesSection, ElectiveGroupsSection } from "./course-list/CourseSections";
import {
  CourseFormModal,
  GroupFormModal,
  useCourseForm,
} from "./course-list/CourseListModals";

interface CourseListProps {
  semesterId: string;
  deptId: string;
}

export default function CourseList({ semesterId, deptId }: CourseListProps) {
  const { data: courses, isLoading } = useCourses(semesterId);
  const { data: electiveGroups } = useElectiveGroups(semesterId);
  const createMutation = useCreateCourse(semesterId, deptId);
  const updateMutation = useUpdateCourse(semesterId, deptId);
  const deleteMutation = useDeleteCourse(semesterId, deptId);
  const createGroupMutation = useCreateElectiveGroup(semesterId, deptId);
  const updateGroupMutation = useUpdateElectiveGroup(semesterId);
  const deleteGroupMutation = useDeleteElectiveGroup(semesterId, deptId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ElectiveGroup | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  // Course form state (fields populate from editCourse inside the hook)
  const form = useCourseForm(editCourse);

  // Group form state
  const [groupName, setGroupName] = useState("");

  const courseToDelete = courses?.find((c) => c._id === deleteId);
  const coreCourses = courses?.filter((c) => c.courseType === "core" || !c.courseType) ?? [];

  const resetForm = () => {
    form.reset();
    setEditCourse(null);
  };

  const handleOpenCreate = (groupId?: string) => {
    resetForm();
    if (groupId) {
      form.setCourseType("elective");
      form.setElectiveGroupId(groupId);
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (course: Course) => {
    setEditCourse(course);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code,
      credits: Number(form.credits),
      semester: semesterId,
      exams: form.exams,
      courseType: form.courseType,
      electiveGroup: form.courseType !== "core" ? form.electiveGroupId || null : null,
    };

    if (editCourse) {
      updateMutation.mutate(
        { id: editCourse._id, data: payload },
        { onSuccess: handleCloseModal }
      );
    } else {
      createMutation.mutate(payload, { onSuccess: handleCloseModal });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleOpenCreateGroup = () => {
    setEditGroup(null);
    setGroupName("");
    setGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group: ElectiveGroup) => {
    setEditGroup(group);
    setGroupName(group.name);
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    setGroupModalOpen(false);
    setEditGroup(null);
    setGroupName("");
  };

  const handleSubmitGroup = (e: FormEvent) => {
    e.preventDefault();
    if (editGroup) {
      updateGroupMutation.mutate(
        { id: editGroup._id, data: { name: groupName } },
        { onSuccess: handleCloseGroupModal }
      );
    } else {
      createGroupMutation.mutate(
        { name: groupName, semester: semesterId },
        { onSuccess: handleCloseGroupModal }
      );
    }
  };

  const handleConfirmDeleteGroup = () => {
    if (!deleteGroupId) return;
    deleteGroupMutation.mutate(deleteGroupId, {
      onSuccess: () => setDeleteGroupId(null),
    });
  };

  const isEdit = !!editCourse;
  const mutation = isEdit ? updateMutation : createMutation;

  if (isLoading) return null;

  return (
    <div className="mt-3 space-y-4">
      <CoreCoursesSection
        courses={coreCourses}
        onAdd={handleOpenCreate}
        onEdit={handleOpenEdit}
        onDelete={setDeleteId}
      />

      <ElectiveGroupsSection
        groups={electiveGroups}
        onAddGroup={handleOpenCreateGroup}
        onEditCourse={handleOpenEdit}
        onDeleteCourse={setDeleteId}
        onEditGroup={handleOpenEditGroup}
        onDeleteGroup={setDeleteGroupId}
        onAddCourse={handleOpenCreate}
      />

      <CourseFormModal
        open={modalOpen}
        isEdit={isEdit}
        form={form}
        electiveGroups={electiveGroups}
        mutation={mutation}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <GroupFormModal
        open={groupModalOpen}
        editGroup={editGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        createStatus={createGroupMutation}
        updateStatus={updateGroupMutation}
        onClose={handleCloseGroupModal}
        onSubmit={handleSubmitGroup}
      />

      <ConfirmDeleteModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
        title="Delete Course"
        message={`This will permanently delete "${courseToDelete?.code ?? ""} — ${courseToDelete?.name ?? ""}". This action cannot be undone.`}
      />

      <ConfirmDeleteModal
        open={!!deleteGroupId}
        onClose={() => setDeleteGroupId(null)}
        onConfirm={handleConfirmDeleteGroup}
        isLoading={deleteGroupMutation.isPending}
        title="Delete Elective Group"
        message="This will delete the group. Courses in it will become core courses. This cannot be undone."
      />
    </div>
  );
}
