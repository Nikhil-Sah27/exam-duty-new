import { useMutation, useMutationState, useQuery } from "@tanstack/react-query";

import {
  deleteMessage,
  editMessage,
  fetchConversation,
  fetchConversations,
  fetchCsUnread,
  fetchMessageableTeachers,
  fetchMyThread,
  fetchMyUnread,
  reactToMessage,
  sendCsReply,
  sendMyMessage,
  startConversation,
  type ChatMessage,
  type Thread,
} from "@/features/messages/api";
import { queryClient } from "@/lib/queryClient";
import { isTeacherRole } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";

// Same cadence as the web (frontend/src/modules/messages/hooks/useMessages.ts):
// pushes nudge a refetch, and a modest poll is the fallback live signal. React
// Query pauses it while the app is in the background and refetches on return.
const POLL_MS = 15_000;

export const messageKeys = {
  all: ["messages"] as const,
  thread: ["messages", "thread"] as const,
  unread: ["messages", "unread"] as const,
  send: ["messages", "send"] as const,
  // CS side
  inbox: ["messages", "inbox"] as const,
  csUnread: ["messages", "cs-unread"] as const,
  conversation: (id: string) => ["messages", "conversation", id] as const,
};

/**
 * One chat the screen can show — the teacher's own thread with CS, or (for CS)
 * one teacher's conversation. Every thread hook takes a channel, so the chat UI
 * (ChatScreen + components) is the same code for both sides.
 */
export interface ChatChannel {
  /** React Query key of the thread. */
  key: readonly unknown[];
  /** Mutation key of its sends (pending bubbles are per chat). */
  sendKey: readonly unknown[];
  /** The viewer is CS: their bubbles are the CS ones, read ticks follow the teacher. */
  viewerIsCs: boolean;
  fetch: () => Promise<Thread>;
  send: (body: string, replyTo: string | null) => Promise<ChatMessage>;
  /** Unread caches the server cleared by opening / replying in this chat. */
  unreadKey: readonly unknown[];
}

/** The teacher's single thread with the CS office. */
export const teacherChannel: ChatChannel = {
  key: messageKeys.thread,
  sendKey: messageKeys.send,
  viewerIsCs: false,
  fetch: fetchMyThread,
  send: sendMyMessage,
  unreadKey: messageKeys.unread,
};

/** CS's view of one teacher's conversation. */
export const csChannel = (conversationId: string): ChatChannel => ({
  key: messageKeys.conversation(conversationId),
  sendKey: [...messageKeys.send, conversationId],
  viewerIsCs: true,
  fetch: () => fetchConversation(conversationId),
  send: (body, replyTo) => sendCsReply(conversationId, body, replyTo),
  unreadKey: messageKeys.csUnread,
});

function useRole() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  return { signedIn: !!token, role };
}

/** The thread endpoints are teacher-only (CS gets a 400), so only poll with a teacher token. */
function useCanMessage(): boolean {
  const { signedIn, role } = useRole();
  return signedIn && isTeacherRole(role);
}

function useIsCs(): boolean {
  const { signedIn, role } = useRole();
  return signedIn && role === "cs";
}

/** Opening / replying marks the chat read server-side; refresh the unread badges. */
async function refreshUnread(channel: ChatChannel) {
  await queryClient.invalidateQueries({ queryKey: channel.unreadKey });
  if (channel.viewerIsCs) await queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
}

/** Put a server-returned message into the cached thread (replace by id, else append). */
function upsertMessage(channel: ChatChannel, message: ChatMessage) {
  queryClient.setQueryData<Thread>(channel.key, (old) => {
    if (!old) return old;
    const idx = old.messages.findIndex((m) => m._id === message._id);
    const messages = idx >= 0 ? old.messages.map((m, i) => (i === idx ? message : m)) : [...old.messages, message];
    return { ...old, messages };
  });
}

/** A chat's thread, polled while mounted. Each fetch marks it read. */
export function useThread(channel: ChatChannel) {
  const canTeacher = useCanMessage();
  const isCs = useIsCs();
  return useQuery({
    queryKey: channel.key,
    queryFn: async () => {
      const thread = await channel.fetch();
      void refreshUnread(channel);
      return thread;
    },
    enabled: channel.viewerIsCs ? isCs : canTeacher,
    staleTime: 0,
    refetchInterval: POLL_MS,
  });
}

/**
 * Unread messages from CS — for the teacher's Messages tab / Home badge.
 * Returns the React Query result; `data` is the count (undefined until loaded).
 */
export function useUnreadMessages() {
  const enabled = useCanMessage();
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: fetchMyUnread,
    enabled,
    refetchInterval: POLL_MS,
  });
}

/** CS: unread messages from teachers, across every conversation (Messages tab badge). */
export function useCsUnreadMessages() {
  const enabled = useIsCs();
  return useQuery({ queryKey: messageKeys.csUnread, queryFn: fetchCsUnread, enabled, refetchInterval: POLL_MS });
}

/** CS: the inbox — every teacher conversation, most recent first. */
export function useConversations() {
  const enabled = useIsCs();
  return useQuery({ queryKey: messageKeys.inbox, queryFn: fetchConversations, enabled, refetchInterval: POLL_MS });
}

/** CS: who a new chat can be opened with. */
export function useMessageableTeachers() {
  const enabled = useIsCs();
  return useQuery({ queryKey: [...messageKeys.all, "teachers"], queryFn: fetchMessageableTeachers, enabled, staleTime: 5 * 60_000 });
}

/** CS: open (or reuse) a teacher's conversation. */
export function useStartConversation() {
  return useMutation({
    mutationFn: (teacherId: string) => startConversation(teacherId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageKeys.inbox }),
  });
}

export interface SendVars {
  body: string;
  replyTo: ChatMessage | null;
  /** Client-side id for the pending bubble. */
  tempId: string;
  createdAt: string;
}

export function useSendMessage(channel: ChatChannel) {
  return useMutation({
    mutationKey: channel.sendKey,
    mutationFn: (v: SendVars) => channel.send(v.body, v.replyTo?._id ?? null),
    onSuccess: async (message) => {
      upsertMessage(channel, message);
      await refreshUnread(channel); // sending also marks the chat read server-side
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: channel.key }),
  });
}

/** Messages still on their way to the server, shown as pending bubbles at the end of the thread. */
export function usePendingSends(channel: ChatChannel): SendVars[] {
  return useMutationState({
    filters: { mutationKey: channel.sendKey, status: "pending", exact: true },
    select: (m) => m.state.variables as SendVars,
  });
}

// Message actions: write the returned message into the cache straight away, then
// invalidate the whole messages tree (as the web does) so previews stay in step.
const afterAction = (channel: ChatChannel) => async (message: ChatMessage) => {
  upsertMessage(channel, message);
  await queryClient.invalidateQueries({ queryKey: messageKeys.all });
};

export function useEditMessage(channel: ChatChannel) {
  return useMutation({
    mutationFn: (v: { id: string; body: string }) => editMessage(v.id, v.body),
    onSuccess: afterAction(channel),
  });
}

export function useDeleteMessage(channel: ChatChannel) {
  return useMutation({ mutationFn: (id: string) => deleteMessage(id), onSuccess: afterAction(channel) });
}

export function useReactMessage(channel: ChatChannel) {
  return useMutation({
    mutationFn: (v: { id: string; emoji: string }) => reactToMessage(v.id, v.emoji),
    onSuccess: afterAction(channel),
  });
}
