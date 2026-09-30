import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Headset, Loader2, Search } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMyThread, useSendMyMessage } from "../hooks/useMessages";
import { useThreadActions } from "../hooks/useThreadActions";
import MessageThread from "../components/MessageThread";
import MessageComposer from "../components/MessageComposer";

/**
 * A teacher's (Invigilator / RS / DCS) direct thread with the CS office —
 * complaints, questions, anything. One conversation per teacher; CS sees it in
 * their inbox.
 */
export default function TeacherMessagesPage() {
  const { data, isLoading, error, refetch } = useMyThread();
  const send = useSendMyMessage();
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  const actions = useThreadActions((body, replyTo) =>
    send.mutate({ body, replyTo }),
  );

  // Opening the thread resets this teacher's unread count server-side, so clear
  // the sidebar badge as soon as the thread loads.
  useEffect(() => {
    if (data) qc.invalidateQueries({ queryKey: ["messages", "my-unread"] });
  }, [data, qc]);

  const hasMessages = (data?.messages?.length ?? 0) > 0;

  return (
    <div className="-mx-6 -mb-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/30 backdrop-blur">
            <Headset className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-indigo-600 bg-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Controller (CS)</p>
            <p className="text-[11px] text-indigo-100">
              Exam Duty office · usually replies within a day
            </p>
          </div>
          {hasMessages && (
            <button
              onClick={() => actions.setSearchOpen((o) => !o)}
              aria-label="Search in conversation"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors ${
                actions.searchOpen ? "bg-white/30" : "hover:bg-white/20"
              }`}
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading messages…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-100">
              <AlertCircle className="h-6 w-6" />
            </span>
            <p className="text-sm text-gray-500">Couldn't load your messages.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-indigo-50/40 to-gray-50 dark:from-gray-900 dark:to-gray-950">
            <MessageThread
              messages={data?.messages ?? []}
              viewerIsCs={false}
              otherLastReadAt={data?.conversation?.csLastReadAt ?? null}
              myUserId={myUserId}
              searchOpen={actions.searchOpen}
              onCloseSearch={() => actions.setSearchOpen(false)}
              onReply={actions.onReply}
              onEdit={actions.onEdit}
              onDelete={actions.onDelete}
              onReact={actions.onReact}
              emptyHint="No messages yet. Send the CS office a message to start the conversation."
            />
            <MessageComposer
              onSend={actions.submitSend}
              isSending={send.isPending}
              replyTo={actions.replyTo}
              onCancelReply={actions.onCancelReply}
              editing={actions.editing}
              onSaveEdit={actions.onSaveEdit}
              onCancelEdit={actions.onCancelEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
