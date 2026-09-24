import Modal from "./Modal";

interface ConfirmActionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: "primary" | "danger" | "warning";
}

/**
 * Lightweight "are you sure?" gate for irreversible or user-visible actions
 * (claiming a duty, submitting a selection, etc.). Deliberately has no
 * type-to-confirm field — this is a friction-lite check, not a destructive
 * confirmation. For destructive flows, use the module-specific ConfirmModal
 * variants that require typing.
 */
export default function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  variant = "primary",
}: ConfirmActionModalProps) {
  const confirmColor =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
      : variant === "warning"
      ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
      : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-gray-600">{description}</div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed ${confirmColor}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
