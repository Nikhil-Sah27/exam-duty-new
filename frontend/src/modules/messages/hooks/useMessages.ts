import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearConversation,
  deleteMessage,
  editMessage,
  fetchConversation,
  fetchConversations,
  fetchCsUnread,
  fetchMyThread,
  fetchMyUnread,
  reactToMessage,
  replyConversation,
  sendMyMessage,
  startConversation,
} from "../services/messageService";

const KEYS = {
  myThread: ["messages", "my-thread"] as const,
  myUnread: ["messages", "my-unread"] as const,
  conversations: ["messages", "conversations"] as const,
  csUnread: ["messages", "cs-unread"] as const,
  conversation: (id: string) => ["messages", "conversation", id] as const,
};

// Poll so new messages appear without a manual refresh (kept modest so it's
// light on the server — messaging here is low-volume).
const POLL_MS = 15_000;

export function useMyThread() {
  return useQuery({
    queryKey: KEYS.myThread,
    queryFn: fetchMyThread,
    refetchInterval: POLL_MS,
  });
}

export function useSendMyMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { body: string; replyTo?: string | null }) =>
      sendMyMessage(vars.body, vars.replyTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.myThread });
      qc.invalidateQueries({ queryKey: KEYS.myUnread });
    },
  });
}

// Teacher's unread count from CS — drives the sidebar "Messages" badge. Reading
// the thread resets it server-side, so re-fetch after the thread query settles.
export function useMyUnread(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.myUnread,
    queryFn: fetchMyUnread,
    enabled,
    refetchInterval: POLL_MS,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: KEYS.conversations,
    queryFn: fetchConversations,
    refetchInterval: POLL_MS,
  });
}

// CS's total unread across all teacher threads — the CS sidebar badge.
export function useCsUnread(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.csUnread,
    queryFn: fetchCsUnread,
    enabled,
    refetchInterval: POLL_MS,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: KEYS.conversation(id ?? ""),
    queryFn: () => fetchConversation(id as string),
    enabled: Boolean(id),
    refetchInterval: POLL_MS,
  });
}

// CS starts (or reuses) a conversation with a selected teacher.
export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teacherId: string) => startConversation(teacherId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.conversations }),
  });
}

export function useReplyConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { body: string; replyTo?: string | null }) =>
      replyConversation(id, vars.body, vars.replyTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.conversation(id) });
      qc.invalidateQueries({ queryKey: KEYS.conversations });
      qc.invalidateQueries({ queryKey: KEYS.csUnread });
    },
  });
}

// ── Message actions — invalidate the whole messages tree (low volume, keeps
//    every open view, thread + inbox previews, in sync after a change). ──
function useMessagesInvalidator() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["messages"] });
}

export function useEditMessage() {
  const invalidate = useMessagesInvalidator();
  return useMutation({
    mutationFn: (vars: { id: string; body: string }) =>
      editMessage(vars.id, vars.body),
    onSuccess: invalidate,
  });
}

export function useDeleteMessage() {
  const invalidate = useMessagesInvalidator();
  return useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: invalidate,
  });
}

export function useReactMessage() {
  const invalidate = useMessagesInvalidator();
  return useMutation({
    mutationFn: (vars: { id: string; emoji: string }) =>
      reactToMessage(vars.id, vars.emoji),
    onSuccess: invalidate,
  });
}

export function useClearConversation() {
  const invalidate = useMessagesInvalidator();
  return useMutation({
    mutationFn: (id: string) => clearConversation(id),
    onSuccess: invalidate,
  });
}
