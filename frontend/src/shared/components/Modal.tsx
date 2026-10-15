import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Width: "md" (default, forms) · "lg" · "xl" (tables, e.g. a CSV preview). */
  size?: "md" | "lg" | "xl";
}

const WIDTH = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  if (!open) return null;

  // Rendered into document.body so the modal escapes any interactive ancestor
  // in the DOM. React synthetic events, however, still bubble through the
  // React tree — so we also stop propagation at the modal root, otherwise a
  // click inside the modal would reach an ancestor onClick (e.g. a
  // <tr onClick=navigate>) and trigger unintended behavior.
  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className={`max-h-[90vh] w-full ${WIDTH[size]} overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
