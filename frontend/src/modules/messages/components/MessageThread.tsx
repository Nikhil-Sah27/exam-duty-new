import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  MessagesSquare,
  Search,
  X,
} from "lucide-react";
import type { ChatMessage } from "../types/message.types";
import { formatDayDivider, formatMessageTime, isNewDay } from "../utils/format";
import MessageBubble from "./MessageBubble";

interface MessageThreadProps {
  messages: ChatMessage[];
  /** Whose perspective — decides which bubbles align right ("mine"). */
  viewerIsCs: boolean;
  emptyHint: string;
  /** When the *other* party last read — drives the blue double-tick. */
  otherLastReadAt?: string | null;
  /** The viewer's user id — to detect which reactions are theirs. */
  myUserId: string | null;
  searchOpen?: boolean;
  onCloseSearch?: () => void;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
}

/** Scrollable thread with day dividers, in-chat search, and a jump-to-latest FAB. */
export default function MessageThread({
  messages,
  viewerIsCs,
  emptyHint,
  otherLastReadAt,
  myUserId,
  searchOpen,
  onCloseSearch,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const firstScroll = useRef(true);
  const prevLen = useRef(messages.length);

  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [term, setTerm] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  const readCutoff = otherLastReadAt ? new Date(otherLastReadAt).getTime() : 0;

  // Search matches (message ids), computed from the current term.
  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages
      .filter((m) => !m.deleted && m.body.toLowerCase().includes(q))
      .map((m) => m._id);
  }, [term, messages]);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
    setNewCount(0);
  };

  // Auto-scroll on new messages when the viewer is already at the bottom.
  useLayoutEffect(() => {
    const grew = messages.length > prevLen.current;
    if (firstScroll.current) {
      scrollToBottom("auto");
      firstScroll.current = false;
    } else if (grew && !searchOpen && atBottom) {
      scrollToBottom("smooth");
    } else if (grew && !atBottom) {
      setNewCount((c) => c + (messages.length - prevLen.current));
    }
    prevLen.current = messages.length;
  }, [messages.length, atBottom, searchOpen]);

  // Jump to the active search match.
  useEffect(() => {
    if (!matches.length) return;
    const id = matches[Math.min(activeMatch, matches.length - 1)];
    itemRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatch, matches]);

  useEffect(() => {
    setActiveMatch(0);
  }, [term]);

  useEffect(() => {
    if (!searchOpen) setTerm("");
  }, [searchOpen]);

  const stepMatch = (dir: 1 | -1) => {
    if (!matches.length) return;
    setActiveMatch((i) => (i + dir + matches.length) % matches.length);
  };

  const activeMatchId = matches.length
    ? matches[Math.min(activeMatch, matches.length - 1)]
    : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search in conversation"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {term && (
            <span className="shrink-0 text-xs tabular-nums text-gray-400">
              {matches.length ? activeMatch + 1 : 0}/{matches.length}
            </span>
          )}
          <button
            onClick={() => stepMatch(-1)}
            disabled={!matches.length}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Previous match"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => stepMatch(1)}
            disabled={!matches.length}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Next match"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={onCloseSearch}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 ring-1 ring-indigo-100">
            <MessagesSquare className="h-7 w-7" />
          </span>
          <p className="max-w-xs text-sm text-gray-400">{emptyHint}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={() => setAtBottom(isNearBottom())}
          className="flex-1 space-y-1 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = isNewDay(prev?.createdAt, m.createdAt);
            const mine = m.senderIsCs === viewerIsCs;
            const grouped = !showDay && !!prev && prev.senderIsCs === m.senderIsCs;
            return (
              <div
                key={m._id}
                ref={(el) => {
                  itemRefs.current[m._id] = el;
                }}
              >
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500 shadow-sm ring-1 ring-gray-200/70">
                      {formatDayDivider(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className={grouped ? "mt-0.5" : "mt-3"}>
                  <MessageBubble
                    message={m}
                    mine={mine}
                    time={formatMessageTime(m.createdAt)}
                    senderName={
                      typeof m.sender === "object" ? m.sender?.name : undefined
                    }
                    grouped={grouped}
                    myUserId={myUserId}
                    searchTerm={searchOpen ? term : ""}
                    isActiveMatch={activeMatchId === m._id}
                    status={
                      mine
                        ? readCutoff >= new Date(m.createdAt).getTime()
                          ? "read"
                          : "sent"
                        : undefined
                    }
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReact={onReact}
                  />
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {!atBottom && messages.length > 0 && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 right-4 flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-gray-600 shadow-lg ring-1 ring-gray-200 transition-transform hover:scale-105"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="h-4 w-4" />
          {newCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
