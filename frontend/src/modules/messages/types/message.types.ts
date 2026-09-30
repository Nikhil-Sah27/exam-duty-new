import type { UserRole } from "@/shared/lib/types";

export interface Reaction {
  user: { _id: string; name: string } | string;
  emoji: string;
}

export interface ReplyPreview {
  _id: string;
  body: string;
  senderIsCs: boolean;
  deleted?: boolean;
  sender?: { _id: string; name: string } | string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: { _id: string; name: string } | string;
  senderIsCs: boolean;
  body: string;
  createdAt: string;
  replyTo?: ReplyPreview | null;
  reactions?: Reaction[];
  editedAt?: string | null;
  deleted?: boolean;
}

export interface ConversationTeacher {
  _id: string;
  name: string;
  email: string;
  department?: string | null;
  designation?: string | null;
  roles?: UserRole[];
}

export interface Conversation {
  _id: string;
  teacher: ConversationTeacher | string;
  lastMessageBody: string;
  lastMessageAt: string | null;
  lastSenderIsCs: boolean;
  csUnread: number;
  teacherUnread: number;
  csLastReadAt: string | null;
  teacherLastReadAt: string | null;
  updatedAt: string;
}

export interface Thread {
  conversation: Conversation;
  messages: ChatMessage[];
}
