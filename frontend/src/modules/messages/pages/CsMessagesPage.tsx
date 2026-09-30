import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MessagesSquare,
  MoreVertical,
  PenSquare,
  Search,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  useClearConversation,
  useConversation,
  useConversations,
  useReplyConversation,
  useStartConversation,
} from "../hooks/useMessages";
import { useThreadActions } from "../hooks/useThreadActions";
import type { Conversation, ConversationTeacher } from "../types/message.types";
import ConversationList from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import MessageComposer from "../components/MessageComposer";
import NewConversationModal from "../components/NewConversationModal";
import TeacherProfileModal from "../components/TeacherProfileModal";
import { initials } from "../utils/format";

const teacherName = (c: Conversation) =>
  typeof c.teacher === "object" ? c.teacher.name : "";

/**
 * CS inbox: a two-pane messaging view — every teacher's thread on the left, the
 * selected conversation on the right, with a reply composer.
 */
export default function CsMessagesPage() {
  const { data: conversations = [], isLoading } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const threadQuery = useConversation(activeId);
  const reply = useReplyConversation(activeId ?? "");
  const clear = useClearConversation();
  const startConversation = useStartConversation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  const actions = useThreadActions((body, replyTo) =>
    reply.mutate({ body, replyTo }),
  );

  const handleStart = (teacherId: string) => {
    setStartingId(teacherId);
    startConversation.mutate(teacherId, {
      onSuccess: (conversation) => {
        if (conversation?._id) setActiveId(conversation._id);
        setPickerOpen(false);
      },
      onSettled: () => setStartingId(null),
    });
  };

  const openPicker = () => {
    startConversation.reset();
    setPickerOpen(true);
  };

  // Opening a conversation resets its unread count server-side; once the thread
  // has loaded, refresh the inbox list + total badge so the read state shows.
  useEffect(() => {
    if (!activeId || !threadQuery.isSuccess) return;
    qc.invalidateQueries({ queryKey: ["messages", "cs-unread"] });
    qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
  }, [activeId, threadQuery.isSuccess, qc]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      teacherName(c).toLowerCase().includes(q),
    );
  }, [conversations, term]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.csUnread || 0), 0),
    [conversations],
  );

  const active = conversations.find((c) => c._id === activeId);
  const activeTeacher: ConversationTeacher | null =
    active && typeof active.teacher === "object" ? active.teacher : null;
  const hasMessages = (threadQuery.data?.messages?.length ?? 0) > 0;

  const handleClear = () => {
    setMenuOpen(false);
    if (activeId && window.confirm("Clear this entire conversation history?")) {
      clear.mutate(activeId);
    }
  };

  return (
    <div className="-mx-6 -mb-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-gray-200 bg-white md:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className="z-10 flex min-h-0 flex-col border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200 md:shadow-[3px_0_8px_-4px_rgba(0,0,0,0.15)]">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">Inbox</span>
              {totalUnread > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={openPicker}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all hover:scale-[1.03] hover:shadow-md"
            >
              <PenSquare className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="border-b border-gray-200 px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <ConversationList
                conversations={filtered}
                activeId={activeId}
                onSelect={setActiveId}
              />
            )}
          </div>
        </div>

        {/* Thread + composer */}
        <div className="flex min-h-0 flex-col bg-gradient-to-b from-indigo-50/40 to-gray-50 dark:from-gray-900 dark:to-gray-950">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-gray-400">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 ring-1 ring-indigo-100">
                <MessagesSquare className="h-7 w-7" />
              </span>
              <p className="max-w-xs text-sm">
                Select a conversation to read and reply, or start a new one.
              </p>
            </div>
          ) : (
            <>
              <div className="z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3.5 shadow-sm">
                <button
                  onClick={() => setProfileOpen(true)}
                  title="View teacher details"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                    {initials(activeTeacher?.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {activeTeacher?.name ?? "Teacher"}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">
                      {[activeTeacher?.designation, activeTeacher?.department]
                        .filter(Boolean)
                        .join(" · ") || "Teacher"}
                    </p>
                  </div>
                </button>

                {hasMessages && (
                  <button
                    onClick={() => actions.setSearchOpen((o) => !o)}
                    aria-label="Search in conversation"
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors ${
                      actions.searchOpen
                        ? "bg-indigo-100 text-indigo-600"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                )}

                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Conversation options"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                      <button
                        onClick={handleClear}
                        disabled={!hasMessages || clear.isPending}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear chat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {threadQuery.isLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                <MessageThread
                  messages={threadQuery.data?.messages ?? []}
                  viewerIsCs
                  otherLastReadAt={
                    threadQuery.data?.conversation?.teacherLastReadAt ?? null
                  }
                  myUserId={myUserId}
                  searchOpen={actions.searchOpen}
                  onCloseSearch={() => actions.setSearchOpen(false)}
                  onReply={actions.onReply}
                  onEdit={actions.onEdit}
                  onDelete={actions.onDelete}
                  onReact={actions.onReact}
                  emptyHint="No messages in this conversation yet. Say hello!"
                />
              )}

              <MessageComposer
                onSend={actions.submitSend}
                isSending={reply.isPending}
                replyTo={actions.replyTo}
                onCancelReply={actions.onCancelReply}
                editing={actions.editing}
                onSaveEdit={actions.onSaveEdit}
                onCancelEdit={actions.onCancelEdit}
              />
            </>
          )}
        </div>
      </div>

      <NewConversationModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleStart}
        startingId={startingId}
        errorMessage={
          startConversation.isError
            ? (startConversation.error as Error)?.message ||
              "Couldn't start the conversation. Please try again."
            : null
        }
      />

      <TeacherProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        teacherId={activeTeacher?._id ?? null}
        fallbackName={activeTeacher?.name}
      />
    </div>
  );
}
