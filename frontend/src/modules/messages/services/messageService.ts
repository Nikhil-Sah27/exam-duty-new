import api from "@/shared/lib/api";
import type { ChatMessage, Conversation, Thread } from "../types/message.types";

interface Single<T> {
  success: boolean;
  data: T;
}
interface List<T> {
  success: boolean;
  count: number;
  data: T;
}

// ── Teacher side (each teacher has one thread with CS) ──
export const fetchMyThread = async (): Promise<Thread> =>
  (await api.get<Single<Thread>>("/messages/thread")).data.data;

export const sendMyMessage = async (
  body: string,
  replyTo?: string | null,
): Promise<ChatMessage> =>
  (await api.post<Single<ChatMessage>>("/messages/thread", { body, replyTo }))
    .data.data;

export const fetchMyUnread = async (): Promise<number> =>
  (await api.get<Single<{ count: number }>>("/messages/thread/unread")).data.data
    .count;

export const fetchCsUnread = async (): Promise<number> =>
  (await api.get<Single<{ count: number }>>("/messages/conversations/unread"))
    .data.data.count;

// ── CS side (inbox of every teacher's thread) ──
export const fetchConversations = async (): Promise<Conversation[]> =>
  (await api.get<List<Conversation[]>>("/messages/conversations")).data.data;

export const fetchConversation = async (id: string): Promise<Thread> =>
  (await api.get<Single<Thread>>(`/messages/conversations/${id}`)).data.data;

// CS opens (or reuses) a thread with a chosen teacher.
export const startConversation = async (
  teacherId: string,
): Promise<Conversation> =>
  (
    await api.post<Single<Conversation>>("/messages/conversations/start", {
      teacherId,
    })
  ).data.data;

export const replyConversation = async (
  id: string,
  body: string,
  replyTo?: string | null,
): Promise<ChatMessage> =>
  (
    await api.post<Single<ChatMessage>>(`/messages/conversations/${id}`, {
      body,
      replyTo,
    })
  ).data.data;

export const clearConversation = async (id: string): Promise<Conversation> =>
  (await api.delete<Single<Conversation>>(`/messages/conversations/${id}/messages`))
    .data.data;

// ── Message actions (either participant) ──
export const editMessage = async (
  id: string,
  body: string,
): Promise<ChatMessage> =>
  (await api.patch<Single<ChatMessage>>(`/messages/msg/${id}`, { body })).data
    .data;

export const deleteMessage = async (id: string): Promise<ChatMessage> =>
  (await api.delete<Single<ChatMessage>>(`/messages/msg/${id}`)).data.data;

export const reactToMessage = async (
  id: string,
  emoji: string,
): Promise<ChatMessage> =>
  (await api.put<Single<ChatMessage>>(`/messages/msg/${id}/reaction`, { emoji }))
    .data.data;
