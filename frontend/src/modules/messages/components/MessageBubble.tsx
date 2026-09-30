import type { ReactNode } from "react";
import { Ban, Check, CheckCheck } from "lucide-react";
import type { ChatMessage, Reaction } from "../types/message.types";
import MessageActions from "./MessageActions";

export type TickStatus = "sent" | "read";

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  time: string;
  senderName?: string;
  grouped?: boolean;
  status?: TickStatus;
  myUserId: string | null;
  searchTerm?: string;
  isActiveMatch?: boolean;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
}

const reactorId = (r: Reaction) =>
  typeof r.user === "object" ? r.user._id : r.user;

/** Aggregate raw reactions into { emoji, count, mine } chips. */
function summarizeReactions(reactions: Reaction[] = [], myId: string | null) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (myId && reactorId(r) === myId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()];
}

/** Highlight every case-insensitive occurrence of `term` within `text`. */
function highlight(text: string, term?: string): ReactNode {
  if (!term) return text;
  const t = term.toLowerCase();
  const out: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const idx = rest.toLowerCase().indexOf(t);
    if (idx < 0) {
      out.push(rest);
      break;
    }
    if (idx > 0) out.push(rest.slice(0, idx));
    out.push(
      <mark key={key++} className="rounded bg-yellow-200 px-0.5 text-gray-900">
        {rest.slice(idx, idx + term.length)}
      </mark>,
    );
    rest = rest.slice(idx + term.length);
  }
  return out;
}

/** A single chat bubble — gradient & right-aligned when it's the viewer's own. */
export default function MessageBubble({
  message,
  mine,
  time,
  senderName,
  grouped = false,
  status,
  myUserId,
  searchTerm,
  isActiveMatch,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const { deleted, replyTo, editedAt } = message;
  const reactions = summarizeReactions(message.reactions, myUserId);
  const canModify = mine && !deleted;

  const copy = () => {
    try {
      navigator.clipboard?.writeText(message.body);
    } catch {
      /* clipboard may be unavailable — ignore */
    }
  };

  const actions = !deleted && (
    <div className="self-center opacity-0 transition-opacity group-hover:opacity-100">
      <MessageActions
        canModify={canModify}
        align={mine ? "right" : "left"}
        onReply={() => onReply(message)}
        onCopy={copy}
        onReact={(e) => onReact(message, e)}
        onEdit={() => onEdit(message)}
        onDelete={() => onDelete(message)}
      />
    </div>
  );

  const replyLabel = replyTo
    ? replyTo.senderIsCs
      ? "Controller (CS)"
      : typeof replyTo.sender === "object"
        ? replyTo.sender?.name
        : "Teacher"
    : "";

  return (
    <div
      className={`group flex items-end gap-1.5 ${
        mine ? "justify-end" : "justify-start"
      }`}
    >
      {mine && actions}

      <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`max-w-[min(80vw,32rem)] px-4 py-2.5 text-sm shadow-sm transition-shadow hover:shadow-md ${
            isActiveMatch ? "ring-2 ring-yellow-400" : ""
          } ${
            deleted
              ? "rounded-2xl bg-gray-100 text-gray-400 ring-1 ring-gray-200"
              : mine
                ? `rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white ${
                    grouped ? "rounded-tr-md" : "rounded-tr-2xl"
                  } rounded-br-md`
                : `rounded-2xl bg-white text-gray-800 ring-1 ring-gray-200/80 ${
                    grouped ? "rounded-tl-md" : "rounded-tl-2xl"
                  } rounded-bl-md`
          }`}
        >
          {deleted ? (
            <p className="flex items-center gap-1.5 italic">
              <Ban className="h-3.5 w-3.5" />
              This message was deleted
            </p>
          ) : (
            <>
              {!grouped && senderName && !mine && (
                <p className="mb-1 text-[11px] font-semibold text-indigo-600">
                  {senderName}
                </p>
              )}

              {replyTo && (
                <div
                  className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                    mine
                      ? "border-white/60 bg-white/15 text-white/90"
                      : "border-indigo-400 bg-indigo-50 text-gray-600"
                  }`}
                >
                  <span className="font-semibold">{replyLabel}</span>
                  <p className="line-clamp-2 opacity-90">
                    {replyTo.deleted ? "Deleted message" : replyTo.body}
                  </p>
                </div>
              )}

              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {highlight(message.body, searchTerm)}
              </p>

              <div
                className={`mt-1 flex items-center justify-end gap-1 ${
                  mine ? "text-white/70" : "text-gray-400"
                }`}
              >
                {editedAt && <span className="text-[10px] italic">edited</span>}
                <span className="text-[10px] tabular-nums">{time}</span>
                {mine && status && (
                  <span
                    aria-label={status === "read" ? "Read" : "Sent"}
                    title={status === "read" ? "Read" : "Sent"}
                  >
                    {status === "read" ? (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-white/70" />
                    )}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {reactions.length > 0 && (
          <div
            className={`-mt-1.5 flex flex-wrap gap-1 ${
              mine ? "justify-end" : "justify-start"
            }`}
          >
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(message, r.emoji)}
                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs shadow-sm ring-1 transition-colors ${
                  r.mine
                    ? "bg-indigo-100 ring-indigo-300"
                    : "bg-white ring-gray-200 hover:bg-gray-50"
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && (
                  <span className="text-[10px] font-semibold text-gray-600">
                    {r.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {!mine && actions}
    </div>
  );
}
