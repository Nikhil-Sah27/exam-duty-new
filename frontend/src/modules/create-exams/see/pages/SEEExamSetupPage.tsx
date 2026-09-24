import { useState } from "react";
import { CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "@/shared/components/Button";
import RoomAssignStep from "../../components/steps/RoomAssignStep";
import { useSEERoutine } from "../hooks/useSEERoutine";
import { useSEERoomAssignment } from "../hooks/useSEERoomAssignment";
import DepartmentSelector from "../components/DepartmentSelector";
import SemesterSelector from "../components/SemesterSelector";
import CourseSelectorCard from "../components/CourseSelectorCard";
import ScheduledRoutineList from "../components/ScheduledRoutineList";

type Phase = "routine" | "rooms" | "done";

/**
 * Full SEE setup workflow. Three phases:
 *   "routine"  — build the per-course schedule (NO database write)
 *   "rooms"    — assign rooms using the reused CIE RoomAssignStep (NO DB write)
 *   "done"     — success screen
 *
 * The exam is created in the database ONLY when the user clicks
 * "Finish & Create Exam" in the rooms phase. Everything before that lives
 * entirely in component state — refreshing or backing out leaves no orphaned
 * records behind.
 */
export default function SEEExamSetupPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("routine");

  const routineHook = useSEERoutine();

  const roomAssignment = useSEERoomAssignment({
    departmentId: routineHook.departmentId,
    semester: routineHook.semester,
    routine: routineHook.routine,
    department: routineHook.department ?? null,
    avgStudentsPerClass: 60,
  });

  const editingEntry =
    routineHook.editingId !== null
      ? routineHook.routine.find((r) => r.localId === routineHook.editingId) ?? null
      : null;

  // Routine → rooms transition. No API call. The room-assignment hook seeds
  // its slot list from the routine + department (slotKey = routine.localId).
  const handleAdvanceToRooms = () => {
    setPhase("rooms");
  };

  // Rooms → finalize. Single transactional create on the backend.
  const handleFinalizeExam = () => {
    roomAssignment.finalize(undefined, {
      onSuccess: () => setPhase("done"),
    });
  };

  // ───────────── Success screen ─────────────
  if (phase === "done") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <div className="mx-auto inline-flex rounded-full bg-green-100 p-5">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">SEE Plan Created</h2>
        <p className="text-sm text-gray-500">
          Semester {routineHook.semester} · {routineHook.routine.length} course
          {routineHook.routine.length !== 1 ? "s" : ""} scheduled · rooms assigned.
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
    // SEE has no shared shift concept — every routine entry carries its own
    // window. Fabricate a shifts array indexed by slot ordinality so the
    // shared `RoomAssignStep` (which looks up `shifts[shiftIndex]`) resolves
    // to the correct time window per slot.
    const seeShifts = routineHook.routine.map((entry) => ({
      name: `${entry.startTime} – ${entry.endTime}`,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));
    return (
      <RoomAssignStep
        slotAllocations={roomAssignment.slotAllocations}
        shifts={seeShifts}
        usedRoomsMap={roomAssignment.usedRoomsMap}
        avgStudentsPerClass={60}
        warnings={roomAssignment.roomWarnings}
        isAssigning={roomAssignment.isFinalizing}
        error={finalizeError}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">SEE — Schedule Setup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Schedule External Examination subjects one by one, then move to room assignment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DepartmentSelector
          value={routineHook.departmentId}
          onChange={(id) =>
            routineHook.setConfig(id, routineHook.semester)
          }
        />
        <SemesterSelector
          value={routineHook.semester}
          onChange={(sem) =>
            routineHook.setConfig(routineHook.departmentId, sem)
          }
          disabled={!routineHook.departmentId}
        />
      </div>

      {configLocked && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Department and semester are locked once you've added courses. Use the Edit/Delete
          buttons below to manage individual schedules.
        </div>
      )}

      {routineHook.departmentId && routineHook.semester && (
        <>
          {routineHook.isLoadingCourses ? (
            <p className="text-sm text-gray-500">Loading courses...</p>
          ) : routineHook.courses.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
              <p className="text-sm text-gray-500">
                No courses found for this department and semester.
              </p>
            </div>
          ) : (
            <CourseSelectorCard
              courses={routineHook.courses}
              scheduledCourseIds={routineHook.scheduledCourseIds}
              editingEntry={editingEntry}
              feedback={routineHook.feedback}
              onSubmit={routineHook.tryAddEntry}
              onCancelEdit={routineHook.cancelEdit}
            />
          )}

          <ScheduledRoutineList
            routine={routineHook.routine}
            editingId={routineHook.editingId}
            onEdit={routineHook.startEdit}
            onDelete={routineHook.removeEntry}
          />

          <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-gray-50/80 px-1 py-4 backdrop-blur">
            <Button
              onClick={handleAdvanceToRooms}
              disabled={!routineHook.canFinish}
            >
              Next: Assign Rooms
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

    </div>
  );
}
