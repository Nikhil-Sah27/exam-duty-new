import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import ChatScreen from "./ChatScreen";
import { ChatHeaderTitle } from "./components/ChatHeaderTitle";
import { teacherOf } from "./components/ConversationRow";
import { csChannel } from "./hooks";

/** CS's chat with one teacher (port of the web CsMessagesPage thread pane). */
export default function CsChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const channel = useMemo(() => csChannel(String(id)), [id]);
  return (
    <ChatScreen
      channel={channel}
      renderTitle={(conversation) => {
        const t = conversation ? teacherOf(conversation) : null;
        const sub = [t?.designation, t?.department].filter(Boolean).join(" · ");
        return <ChatHeaderTitle icon="person" title={t?.name ?? "Teacher"} subtitle={sub || undefined} />;
      }}
      emptyMessage="No messages yet — say hello."
    />
  );
}
