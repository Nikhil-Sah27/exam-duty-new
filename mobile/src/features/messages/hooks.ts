import { useMutation, useMutationState, useQuery } from "@tanstack/react-query";

import {
  deleteMessage,
  editMessage,
  fetchMyThread,
  fetchMyUnread,
  reactToMessage,
  sendMyMessage,
  type ChatMessage,
  type Thread,
} from "@/features/messages/api";
import { queryClient } from "@/lib/queryClient";
import { isTeacherRole } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";

// Same cadence as the web (frontend/src/modules/messages/hooks/useMessages.ts):
// messages don't push, so a modest poll is the live signal. React Query pauses it
// while the app is in the background and refetches on return to the foreground.
const POLL_MS = 15_000;

export const messageKeys = {
  all: ["messages"] as const,
  thread: ["messages", "thread"] as const,
  unread: ["messages", "unread"] as const,
  send: ["messages", "send"] as const,
};

/** The thread endpoints are teacher-only (CS gets a 400), so only poll with a teacher token. */
function useCanMessage(): boolean {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  return !!token && isTeacherRole(role);
}

/** Opening the thread resets the unread count server-side; mirror that locally. */
async function clearUnreadLocally() {
  await queryClient.cancelQueries({ queryKey: messageKeys.unread });
  queryClient.setQueryData<number>(messageKeys.unread, 0);
}

/** Put a server-returned message into the cached thread (replace by id, else append). */
function upsertMessage(message: ChatMessage) {
  queryClient.setQueryData<Thread>(messageKeys.thread, (old) => {
    if (!old) return old;
    const idx = old.messages.findIndex((m) => m._id === message._id);
    const messages = idx >= 0 ? old.messages.map((m, i) => (i === idx ? message : m)) : [...old.messages, message];
    return { ...old, messages };
  });
}

/** The teacher's thread with CS, polled while mounted. Each fetch marks it read. */
export function useMyThread() {
  const enabled = useCanMessage();
  return useQuery({
    queryKey: messageKeys.thread,
    queryFn: async () => {
      const thread = await fetchMyThread();
      await clearUnreadLocally();
      return thread;
    },
    enabled,
    staleTime: 0,
    refetchInterval: POLL_MS,
  });
}

/**
 * Unread messages from CS — for the Home "Message the exam cell" badge.
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

export interface SendVars {
  body: string;
  replyTo: ChatMessage | null;
  /** Client-side id for the pending bubble. */
  tempId: string;
  createdAt: string;
}

export function useSendMessage() {
  return useMutation({
    mutationKey: messageKeys.send,
    mutationFn: (v: SendVars) => sendMyMessage(v.body, v.replyTo?._id ?? null),
    onSuccess: async (message) => {
      upsertMessage(message);
      await clearUnreadLocally(); // sending also marks the thread read server-side
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: messageKeys.thread }),
  });
}

/** Messages still on their way to the server, shown as pending bubbles at the end of the thread. */
export function usePendingSends(): SendVars[] {
  return useMutationState({
    filters: { mutationKey: messageKeys.send, status: "pending" },
    select: (m) => m.state.variables as SendVars,
  });
}

// Message actions: write the returned message into the cache straight away, then
// invalidate the whole messages tree (as the web does) so previews stay in step.
const afterAction = async (message: ChatMessage) => {
  upsertMessage(message);
  await queryClient.invalidateQueries({ queryKey: messageKeys.all });
};

export function useEditMessage() {
  return useMutation({
    mutationFn: (v: { id: string; body: string }) => editMessage(v.id, v.body),
    onSuccess: afterAction,
  });
}

export function useDeleteMessage() {
  return useMutation({ mutationFn: (id: string) => deleteMessage(id), onSuccess: afterAction });
}

export function useReactMessage() {
  return useMutation({
    mutationFn: (v: { id: string; emoji: string }) => reactToMessage(v.id, v.emoji),
    onSuccess: afterAction,
  });
}
