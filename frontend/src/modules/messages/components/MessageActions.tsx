import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Copy,
  Pencil,
  Reply,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { QUICK_REACTIONS } from "../utils/format";

interface MessageActionsProps {
  /** Own, non-deleted message → editing & deleting are allowed. */
  canModify: boolean;
  align: "left" | "right";
  onReply: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

/** Hover chevron → dropdown with quick reactions + reply/copy/edit/delete. */
export default function MessageActions({
  canModify,
  align,
  onReply,
  onCopy,
  onReact,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Message actions"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-500 shadow ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-1 flex items-center justify-around border-b border-gray-100 px-1 pb-1.5 pt-1">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                onClick={run(() => onReact(e))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-base transition-transform hover:scale-125 hover:bg-gray-100"
              >
                {e}
              </button>
            ))}
          </div>
          <Item icon={Reply} label="Reply" onClick={run(onReply)} />
          <Item icon={Copy} label="Copy" onClick={run(onCopy)} />
          {canModify && (
            <>
              <Item icon={Pencil} label="Edit" onClick={run(onEdit)} />
              <Item
                icon={Trash2}
                label="Delete"
                danger
                onClick={run(onDelete)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
