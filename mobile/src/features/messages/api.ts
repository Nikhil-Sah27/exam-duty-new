import api from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";

// Teacher ↔ CS direct messages. Mirrors frontend/src/modules/messages/types +
// services/messageService.ts (teacher side only). Each teacher has exactly one
// thread with the CS office; the backend resolves it from the token, so nothing
// here ever names a conversation or another user.

export interface NamedRef {
  _id: string;
  name: string;
}

export interface Reaction {
  user: NamedRef | string;
  emoji: string;
}

export interface ReplyPreview {
  _id: string;
  body: string;
  senderIsCs: boolean;
  deleted?: boolean;
  sender?: NamedRef | string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: NamedRef | string;
  senderIsCs: boolean;
  /** Empty once deleted (the row stays as a tombstone). */
  body: string;
  createdAt: string;
  replyTo?: ReplyPreview | null;
  reactions?: Reaction[];
  editedAt?: string | null;
  deleted?: boolean;
}

export interface Conversation {
  _id: string;
  lastMessageBody: string;
  lastMessageAt: string | null;
  lastSenderIsCs: boolean;
  csUnread: number;
  teacherUnread: number;
  /** When CS last read the thread — drives the "read" ticks on the teacher's messages. */
  csLastReadAt: string | null;
  teacherLastReadAt: string | null;
  updatedAt: string;
}

export interface Thread {
  conversation: Conversation;
  messages: ChatMessage[];
}

/** The caller's thread with CS, oldest first. Fetching it marks the thread read server-side. */
export async function fetchMyThread(): Promise<Thread> {
  const res = await api.get<ApiEnvelope<Thread>>("/messages/thread");
  return res.data.data;
}

export async function sendMyMessage(body: string, replyTo?: string | null): Promise<ChatMessage> {
  const res = await api.post<ApiEnvelope<ChatMessage>>("/messages/thread", { body, replyTo: replyTo ?? null });
  return res.data.data;
}

/** Messages from CS the teacher hasn't read yet. */
export async function fetchMyUnread(): Promise<number> {
  const res = await api.get<ApiEnvelope<{ count: number }>>("/messages/thread/unread");
  return res.data.data?.count ?? 0;
}

/** Own messages only (the server 403s anything else). */
export async function editMessage(id: string, body: string): Promise<ChatMessage> {
  const res = await api.patch<ApiEnvelope<ChatMessage>>(`/messages/msg/${id}`, { body });
  return res.data.data;
}

/** Delete-for-everyone: returns the tombstone (deleted: true, empty body). */
export async function deleteMessage(id: string): Promise<ChatMessage> {
  const res = await api.delete<ApiEnvelope<ChatMessage>>(`/messages/msg/${id}`);
  return res.data.data;
}

/** One reaction per user: the same emoji again removes it, a different one replaces it. */
export async function reactToMessage(id: string, emoji: string): Promise<ChatMessage> {
  const res = await api.put<ApiEnvelope<ChatMessage>>(`/messages/msg/${id}/reaction`, { emoji });
  return res.data.data;
}
