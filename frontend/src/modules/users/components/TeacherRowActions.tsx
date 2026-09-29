import { useState } from "react";
import { Pencil, Trash2, PowerOff } from "lucide-react";
import { useActivateUser, useDeleteUser } from "../hooks";
import { UserProfile } from "../types";
import ConfirmModal from "./ConfirmModal";
import EditUserModal from "./EditUserModal";

interface TeacherRowActionsProps {
  user: UserProfile;
}

type ConfirmAction = "delete" | "deactivate" | "reactivate" | null;

export default function TeacherRowActions({ user }: TeacherRowActionsProps) {
  const deleteMutation = useDeleteUser();
  const activateMutation = useActivateUser();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [editOpen, setEditOpen] = useState(false);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const openConfirm = (e: React.MouseEvent, action: Exclude<ConfirmAction, null>) => {
    e.stopPropagation();
    setConfirmAction(action);
  };

  const closeConfirm = () => setConfirmAction(null);

  const handleDelete = () =>
    deleteMutation.mutate(user._id, { onSuccess: closeConfirm });
  const handleDeactivate = () =>
    deleteMutation.mutate(user._id, { onSuccess: closeConfirm });
  const handleReactivate = () =>
    activateMutation.mutate(user._id, { onSuccess: closeConfirm });

  // Deactivate/Reactivate is a single toggle button whose visual state signals
  // whether the teacher is currently deactivated (highlighted amber = inactive).
  const powerClasses = user.isActive
    ? "border border-transparent text-gray-400 hover:bg-amber-50 hover:text-amber-600"
    : "border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200";

  return (
    <>
      <div className="flex items-center gap-1" onClick={stop}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
          }}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          onClick={(e) =>
            openConfirm(e, user.isActive ? "deactivate" : "reactivate")
          }
          className={`rounded p-1.5 transition-colors ${powerClasses}`}
          title={user.isActive ? "Deactivate" : "Deactivated — click to reactivate"}
          aria-pressed={!user.isActive}
        >
          <PowerOff className="h-4 w-4" />
        </button>

        <button
          onClick={(e) => openConfirm(e, "delete")}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ConfirmModal
        open={confirmAction === "delete"}
        onClose={closeConfirm}
        onConfirm={handleDelete}
        title={user.isActive ? "Delete User" : "Permanently Delete User"}
        description={
          user.isActive
            ? `This will deactivate "${user.name}". Delete them again once deactivated to remove the record permanently.`
            : `This will permanently delete "${user.name}" and cannot be undone.`
        }
        confirmWord="DELETE"
        confirmLabel={user.isActive ? "Delete User" : "Delete Permanently"}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={confirmAction === "deactivate"}
        onClose={closeConfirm}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        description={`This will deactivate "${user.name}". They will no longer be able to log in or be assigned duties.`}
        confirmWord="DEACTIVATE"
        confirmLabel="Deactivate"
        variant="warning"
        isLoading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={confirmAction === "reactivate"}
        onClose={closeConfirm}
        onConfirm={handleReactivate}
        title="Reactivate User"
        description={`This will reactivate "${user.name}". They will be able to log in and be assigned duties again.`}
        confirmLabel="Reactivate"
        variant="primary"
        isLoading={activateMutation.isPending}
      />

      <EditUserModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
      />
    </>
  );
}
