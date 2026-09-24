import { Modal, ErrorAlert } from "@/shared/components";
import { useAuthStore } from "@/shared/store/auth.store";
import { useSelectRole } from "../hooks";
import type { UserRole } from "@/shared/lib/types";
import RoleSelectionCard from "./RoleSelectionCard";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Compact version of the RoleSelectionPage — invoked from the profile menu's
// "Switch Role" item. Reuses RoleSelectionCard for visual parity.
export default function RoleSelectionModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const selectRoleMutation = useSelectRole();

  if (!user) return null;

  const handleContinue = (role: UserRole) => {
    selectRoleMutation.mutate(role, { onSuccess: () => onClose() });
  };

  return (
    <Modal open={open} onClose={onClose} title="Switch Role">
      {selectRoleMutation.isError && (
        <div className="mb-3">
          <ErrorAlert message={selectRoleMutation.error.message} />
        </div>
      )}
      <p className="mb-4 text-sm text-slate-600">
        You can switch between the dashboards for the roles assigned to you.
      </p>
      <div className="flex flex-col gap-3">
        {user.roles.map((role) => (
          <RoleSelectionCard
            key={role}
            role={role}
            onContinue={() => handleContinue(role)}
            isLoading={
              selectRoleMutation.isPending &&
              selectRoleMutation.variables === role
            }
          />
        ))}
      </div>
    </Modal>
  );
}
