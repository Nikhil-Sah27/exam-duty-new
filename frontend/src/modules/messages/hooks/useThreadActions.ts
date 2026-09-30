import { useState } from "react";
import type { ChatMessage } from "../types/message.types";
import {
  useDeleteMessage,
  useEditMessage,
  useReactMessage,
} from "./useMessages";

/**
 * Shared reply / edit / delete / react / search state + handlers for a chat
 * thread. Both the teacher and CS pages use this; only the "send" implementation
 * differs (teacher thread vs. CS reply), so it's injected.
 */
export function useThreadActions(
  send: (body: string, replyTo?: string | null) => void,
) {
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const edit = useEditMessage();
  const del = useDeleteMessage();
  const react = useReactMessage();

  const onReply = (m: ChatMessage) => {
    setEditing(null);
    setReplyTo(m);
  };
  const onEdit = (m: ChatMessage) => {
    setReplyTo(null);
    setEditing(m);
  };
  const onCancelReply = () => setReplyTo(null);
  const onCancelEdit = () => setEditing(null);

  const onDelete = (m: ChatMessage) => {
    if (window.confirm("Delete this message for everyone?")) {
      del.mutate(m._id);
    }
  };
  const onReact = (m: ChatMessage, emoji: string) =>
    react.mutate({ id: m._id, emoji });

  const onSaveEdit = (body: string) => {
    if (editing) {
      edit.mutate({ id: editing._id, body });
      setEditing(null);
    }
  };

  const submitSend = (body: string) => {
    send(body, replyTo?._id ?? null);
    setReplyTo(null);
  };

  return {
    replyTo,
    editing,
    searchOpen,
    setSearchOpen,
    onReply,
    onEdit,
    onCancelReply,
    onCancelEdit,
    onDelete,
    onReact,
    onSaveEdit,
    submitSend,
  };
}
