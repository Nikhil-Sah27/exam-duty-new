import { Inbox } from "lucide-react";
import type { Conversation, ConversationTeacher } from "../types/message.types";
import { formatMessageTime, initials } from "../utils/format";
import Twemoji from "./Twemoji";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const teacherOf = (c: Conversation): ConversationTeacher | null =>
  typeof c.teacher === "object" ? c.teacher : null;

/** The CS inbox list — one row per teacher, with last message + unread badge. */
export default function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="text-sm text-gray-400">No conversations yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 p-2">
      {conversations.map((c) => {
        const t = teacherOf(c);
        const name = t?.name ?? "Teacher";
        const active = c._id === activeId;
        const unread = c.csUnread > 0;
        return (
          <li key={c._id}>
            <button
              onClick={() => onSelect(c._id)}
              className={`relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all ${
                active
                  ? "border-indigo-200 bg-indigo-50 ring-1 ring-indigo-200"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              )}
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {initials(name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      unread
                        ? "font-bold text-gray-900"
                        : "font-semibold text-gray-800"
                    }`}
                  >
                    {name}
                  </p>
                  {c.lastMessageAt && (
                    <span
                      className={`shrink-0 text-[10px] tabular-nums ${
                        unread ? "font-semibold text-indigo-600" : "text-gray-400"
                      }`}
                    >
                      {formatMessageTime(c.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-xs ${
                      unread ? "text-gray-600" : "text-gray-500"
                    }`}
                  >
                    {c.lastSenderIsCs && (
                      <span className="text-gray-400">You: </span>
                    )}
                    <Twemoji text={c.lastMessageBody || "No messages yet"} />
                  </p>
                  {unread && (
                    <span className="ml-1 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-1.5 text-[10px] font-bold text-white shadow-sm">
                      {c.csUnread > 99 ? "99+" : c.csUnread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
