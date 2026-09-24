import { useState } from "react";
import { Modal } from "@/shared/components";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  // Omit for low-risk actions (e.g. reactivate) to skip type-to-confirm.
  confirmWord?: string;
  confirmLabel: string;
  variant: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmWord,
  confirmLabel,
  variant,
  isLoading,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState("");

  const requiresTyping = !!confirmWord;
  const canConfirm = !requiresTyping || typed === confirmWord;

  const handleClose = () => {
    setTyped("");
    onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
    setTyped("");
  };

  const btnColor =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
      : variant === "warning"
      ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
      : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>

        {requiresTyping && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Type <span className="font-mono font-bold text-red-600">{confirmWord}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={confirmWord}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className={`rounded px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed ${btnColor}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
