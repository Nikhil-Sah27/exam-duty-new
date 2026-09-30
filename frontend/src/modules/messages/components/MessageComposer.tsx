import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Check, Pencil, Reply, Smile, SendHorizontal, X } from "lucide-react";
import type { ChatMessage } from "../types/message.types";
import EmojiPicker from "./EmojiPicker";

interface MessageComposerProps {
  /** Send a new (or reply) message. */
  onSend: (body: string) => void;
  isSending?: boolean;
  disabled?: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  editing?: ChatMessage | null;
  onSaveEdit?: (body: string) => void;
  onCancelEdit?: () => void;
}

const senderLabel = (m: ChatMessage) =>
  m.senderIsCs
    ? "Controller (CS)"
    : typeof m.sender === "object"
      ? m.sender?.name
      : "Teacher";

/** Composer with reply/edit context banners and an emoji picker. */
export default function MessageComposer({
  onSend,
  isSending = false,
  disabled = false,
  replyTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Load the message body when entering edit mode; clear when leaving.
  useEffect(() => {
    setText(editing ? editing.body : "");
    ref.current?.focus();
  }, [editing]);

  // Focus the input when a reply target is chosen.
  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const reset = () => {
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (editing) {
      onSaveEdit?.(trimmed);
    } else {
      onSend(trimmed);
    }
    reset();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
    if (e.key === "Escape") {
      if (editing) onCancelEdit?.();
      else if (replyTo) onCancelReply?.();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    setPickerOpen(false);
    ref.current?.focus();
  };

  const canSend = !isSending && !disabled && !!text.trim();

  return (
    <div className="relative border-t border-gray-200 bg-white shadow-[0_-3px_12px_-5px_rgba(0,0,0,0.15)] dark:!border-gray-800 dark:!bg-gray-900">
      {/* Context banner: editing takes priority over replying */}
      {editing ? (
        <div className="flex items-center gap-2 border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-xs">
          <Pencil className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-700">Editing message</p>
            <p className="truncate text-amber-600/80">{editing.body}</p>
          </div>
          <button
            onClick={onCancelEdit}
            className="rounded p-1 text-amber-600 hover:bg-amber-100"
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        replyTo && (
          <div className="flex items-center gap-2 border-l-4 border-indigo-400 bg-indigo-50 px-4 py-2 text-xs">
            <Reply className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-indigo-700">
                Replying to {senderLabel(replyTo)}
              </p>
              <p className="truncate text-indigo-600/80">{replyTo.body}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="rounded p-1 text-indigo-600 hover:bg-indigo-100"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {pickerOpen && (
        <EmojiPicker onPick={insertEmoji} onClose={() => setPickerOpen(false)} />
      )}

      <form onSubmit={submit} className="flex items-end gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Insert emoji"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            pickerOpen
              ? "bg-indigo-100 text-indigo-600"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          }`}
        >
          <Smile className="h-5 w-5" />
        </button>

        <div className="flex flex-1 items-end rounded-2xl border border-gray-300 bg-gray-100 px-3 py-1.5 shadow-inner transition-colors focus-within:border-indigo-400 focus-within:bg-white focus-within:shadow-none focus-within:ring-2 focus-within:ring-indigo-100 dark:border-gray-600 dark:bg-gray-800 dark:focus-within:bg-gray-800">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={disabled}
            placeholder="Type a message…"
            className="max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-label={editing ? "Save edit" : "Send message"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none"
        >
          {editing ? (
            <Check className="h-5 w-5" />
          ) : (
            <SendHorizontal className="h-[18px] w-[18px]" />
          )}
        </button>
      </form>
    </div>
  );
}
