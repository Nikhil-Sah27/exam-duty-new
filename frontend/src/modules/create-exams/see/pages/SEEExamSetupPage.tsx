import { useState } from "react";
import { CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "@/shared/components/Button";
import RoomAssignStep from "../../components/steps/RoomAssignStep";
import { useSEERoutine } from "../hooks/useSEERoutine";
import { useSEERoomAssignment } from "../hooks/useSEERoomAssignment";
import DepartmentSelector from "../components/DepartmentSelector";
import SemesterSelector from "../components/SemesterSelector";
import DepartmentRoutineSection from "../components/DepartmentRoutineSection";

type Phase = "routine" | "rooms" | "done";

/**
 * Multi-department SEE setup workflow. Three phases:
 *   "routine"  — pick departments + semester, build a per-department schedule
 *   "rooms"    — assign rooms department-by-department (reused RoomAssignStep)
 *   "done"     — success screen
 *
 * One exam card is created per department. The exam is written to the database
 * ONLY when the user clicks "Finish & Create Exam"; everything before that lives
 * in component state, so refreshing or backing out leaves nothing behind.
 */
export default function SEEExamSetupPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("routine");

  const routineHook = useSEERoutine();

  const roomAssignment = useSEERoomAssignment({
    departmentIds: routineHook.departmentIds,
    semester: routineHook.semester,
    routineByDept: routineHook.routineByDept,
    departmentById: routineHook.departmentById,
    avgStudentsPerClass: 40,
  });

  const handleFinalizeExam = () => {
    roomAssignment.finalize(undefined, {
      onSuccess: () => setPhase("done"),
    });
  };

  // ───────────── Success screen ─────────────
  if (phase === "done") {
    const deptCount = routineHook.departmentIds.length;
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <div className="mx-auto inline-flex rounded-full bg-green-100 p-5">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">
          {deptCount > 1 ? `${deptCount} SEE Exams Created` : "SEE Plan Created"}
        </h2>
        <p className="text-sm text-gray-500">
          Semester {routineHook.semester} · {deptCount} department
          {deptCount !== 1 ? "s" : ""} · {routineHook.routine.length} course
          {routineHook.routine.length !== 1 ? "s" : ""} scheduled · rooms assigned.
          {deptCount > 1 ? " Each department has its own exam card." : ""}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate("/exams")}>
            View Exams
          </Button>
          <Button onClick={() => window.location.reload()}>
            <Plus className="mr-1 h-4 w-4" />
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  // ───────────── Room assignment phase ─────────────
  if (phase === "rooms") {
    const finalizeError =
      roomAssignment.finalizeError instanceof Error
        ? roomAssignment.finalizeError.message
        : null;
    return (
      <RoomAssignStep
        slotAllocations={roomAssignment.slotAllocations}
        shifts={roomAssignment.shifts}
        usedRoomsMap={roomAssignment.usedRoomsMap}
        avgStudentsPerClass={40}
        warnings={roomAssignment.roomWarnings}
        isAssigning={roomAssignment.isFinalizing}
        error={finalizeError}
        extraDisabledBySlot={roomAssignment.extraDisabledBySlot}
        groupByDepartment
        onAddRoom={roomAssignment.handleAddRoom}
        onRemoveRoom={roomAssignment.handleRemoveRoom}
        onApplySharing={roomAssignment.handleApplySharing}
        onRemoveSharing={roomAssignment.handleRemoveSharing}
        onSetShareableMark={roomAssignment.handleSetShareableMark}
        onAddGlobalShared={roomAssignment.handleAddGlobalShared}
        onRemoveGlobalShared={roomAssignment.handleRemoveGlobalShared}
        onAssignRooms={handleFinalizeExam}
        onPrev={() => setPhase("routine")}
      />
    );
  }

  // ───────────── Routine-builder phase ─────────────
  const configLocked = routineHook.routine.length > 0;
  const { departmentIds, semester } = routineHook;
  const ready = departmentIds.length > 0 && Boolean(semester);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">SEE — Schedule Setup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select one or more departments, schedule each department's subjects,
          then assign rooms. Each department becomes its own exam.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DepartmentSelector
          value={departmentIds}
          onChange={routineHook.setDepartments}
          disabled={configLocked}
        />
        <SemesterSelector
          value={semester}
          onChange={routineHook.setSemester}
          disabled={departmentIds.length === 0 || configLocked}
        />
      </div>

      {configLocked && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Departments and semester are locked once you've added courses. Use the
          Edit/Delete buttons below to manage individual schedules.
        </div>
      )}

      {ready && (
        <>
          {routineHook.isLoadingCourses ? (
            <p className="text-sm text-gray-500">Loading courses...</p>
          ) : (
            <div className="space-y-5">
              {departmentIds.map((deptId) => {
                const department = routineHook.departmentById.get(deptId);
                if (!department) return null;
                const editingEntry =
                  routineHook.editingEntry?.departmentId === deptId
                    ? routineHook.editingEntry
                    : null;
                return (
                  <DepartmentRoutineSection
                    key={deptId}
                    department={department}
                    routine={routineHook.routineByDept.get(deptId) ?? []}
                    scheduledCourseIds={
                      routineHook.scheduledCourseIdsByDept.get(deptId) ?? new Set()
                    }
                    editingEntry={editingEntry}
                    editingId={routineHook.editingId}
                    feedback={routineHook.feedbackByDept[deptId] ?? null}
                    onSubmit={(input) => routineHook.tryAddEntry(deptId, input)}
                    onCancelEdit={routineHook.cancelEdit}
                    onEdit={routineHook.startEdit}
                    onDelete={routineHook.removeEntry}
                  />
                );
              })}
            </div>
          )}

          <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-gray-50/80 px-1 py-4 backdrop-blur">
            <Button onClick={() => setPhase("rooms")} disabled={!routineHook.canFinish}>
              Next: Assign Rooms
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
