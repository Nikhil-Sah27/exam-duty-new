import ChatScreen from "./ChatScreen";
import { ChatHeaderTitle } from "./components/ChatHeaderTitle";
import { CS_LABEL } from "./format";
import { teacherChannel } from "./hooks";

/**
 * A teacher's (Invigilator / RS / DCS) direct thread with the CS office — port
 * of frontend/src/modules/messages/pages/TeacherMessagesPage.tsx. One
 * conversation per teacher; CS answers from its inbox.
 */
export default function MessagesScreen() {
  return (
    <ChatScreen
      channel={teacherChannel}
      renderTitle={() => (
        <ChatHeaderTitle icon="support" title={CS_LABEL} subtitle="Exam Duty office · usually replies within a day" />
      )}
      emptyMessage="Send the CS office a message to start the conversation — questions, problems with a duty, anything."
    />
  );
}
