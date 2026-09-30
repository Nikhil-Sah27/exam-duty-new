const AppError = require("../../shared/utils/AppError");
const repo = require("./message.repository");
const userService = require("../user/user.service");

const DELETED_PREVIEW = "This message was deleted";

const cleanBody = (body) => {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) throw new AppError("Message cannot be empty", 400);
  if (text.length > 4000) throw new AppError("Message is too long", 400);
  return text;
};

/** Validate a reply target belongs to this conversation and isn't deleted. */
const resolveReplyTo = async (replyToId, conversationId) => {
  if (!replyToId) return null;
  const target = await repo.findMessageById(replyToId);
  if (
    !target ||
    String(target.conversation) !== String(conversationId) ||
    target.deleted
  ) {
    throw new AppError("Invalid reply target", 400);
  }
  return target._id;
};

/** Recompute a conversation's last-message preview after an edit/delete/clear. */
const refreshLastMessage = async (conversationId) => {
  const latest = await repo.latestMessage(conversationId);
  const data = latest
    ? {
        lastMessageBody: latest.deleted ? DELETED_PREVIEW : latest.body,
        lastMessageAt: latest.createdAt,
        lastSenderIsCs: latest.senderIsCs,
      }
    : { lastMessageBody: "", lastMessageAt: null, lastSenderIsCs: false };
  await repo.updateConversation(conversationId, data, { timestamps: false });
};

/**
 * Load a message and authorize the actor as a participant of its conversation.
 * CS may act in any conversation; a teacher only in their own.
 */
const loadMessageForActor = async (messageId, actor) => {
  const message = await repo.findMessageById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  const conversation = await repo.findConversationRaw(message.conversation);
  if (!conversation) throw new AppError("Conversation not found", 404);
  const isCs = actor.activeRole === "cs";
  const isParticipant =
    isCs || String(conversation.teacher) === String(actor.userId);
  if (!isParticipant) throw new AppError("Not authorized for this thread", 403);
  return { message, conversation, isCs };
};

const getOrCreateForTeacher = async (teacherId) => {
  const existing = await repo.findConversationByTeacher(teacherId);
  if (existing) return existing;
  try {
    return await repo.createConversation({ teacher: teacherId });
  } catch (err) {
    // Lost a create race (StrictMode double-invoke / concurrent polls) — the
    // unique `teacher` index rejected the duplicate; the other request won, so
    // just return the conversation it created.
    if (err && err.code === 11000) {
      return repo.findConversationByTeacher(teacherId);
    }
    throw err;
  }
};

// ── Teacher side ──────────────────────────────────────────────────────────

/** The teacher's own thread with CS. Opening it clears their unread badge. */
const getTeacherThread = async (teacherId) => {
  const base = await getOrCreateForTeacher(teacherId);
  const messages = await repo.listMessages(base._id);
  // Mark the teacher caught-up: clear unread and advance their read pointer so
  // CS's sent messages flip to "read". `timestamps:false` keeps a pure read
  // from bumping updatedAt (which would reshuffle the CS inbox order).
  const conversation = await repo.updateConversation(
    base._id,
    { teacherUnread: 0, teacherLastReadAt: new Date() },
    { timestamps: false }
  );
  return { conversation, messages };
};

const sendTeacherMessage = async (teacherId, body, replyTo) => {
  const text = cleanBody(body);
  const conversation = await getOrCreateForTeacher(teacherId);
  const replyRef = await resolveReplyTo(replyTo, conversation._id);
  const message = await repo.createMessage({
    conversation: conversation._id,
    sender: teacherId,
    senderIsCs: false,
    body: text,
    replyTo: replyRef,
  });
  await repo.updateConversation(conversation._id, {
    lastMessageBody: text,
    lastMessageAt: message.createdAt,
    lastSenderIsCs: false,
    teacherUnread: 0,
    teacherLastReadAt: message.createdAt,
    $inc: { csUnread: 1 },
  });
  return repo.findMessagePopulated(message._id);
};

const getTeacherUnread = async (teacherId) => {
  const conversation = await repo.findConversationByTeacher(teacherId);
  return conversation?.teacherUnread || 0;
};

// ── CS side ───────────────────────────────────────────────────────────────

const listConversations = () => repo.listConversations();

/**
 * CS-initiated conversation: pick any teacher and open (or reuse) their thread.
 * A duty and a self-claim are one Duty record; likewise a CS-started and a
 * teacher-started conversation are the same single Conversation per teacher.
 */
const startConversationForTeacher = async (teacherId) => {
  if (!teacherId) throw new AppError("A teacher must be selected", 400);
  const teacher = await userService.getUserById(teacherId); // 404 if missing
  if (Array.isArray(teacher.roles) && teacher.roles.includes("cs")) {
    throw new AppError("Cannot open a teacher thread with a Controller", 400);
  }
  const conversation = await getOrCreateForTeacher(teacherId);
  // Return populated so the inbox can render the teacher immediately.
  return repo.findConversationById(conversation._id);
};

const getCsUnread = () => repo.totalCsUnread();

/** Messages in a conversation for CS. Opening it clears the CS unread. */
const getConversationForCs = async (conversationId) => {
  const existing = await repo.findConversationById(conversationId);
  if (!existing) throw new AppError("Conversation not found", 404);
  const messages = await repo.listMessages(existing._id);
  // Clear CS unread + advance CS read pointer (teacher's msgs flip to "read").
  const conversation = await repo.updateConversation(
    existing._id,
    { csUnread: 0, csLastReadAt: new Date() },
    { timestamps: false }
  );
  return { conversation, messages };
};

const sendCsMessage = async (conversationId, csUserId, body, replyTo) => {
  const text = cleanBody(body);
  const conversation = await repo.findConversationById(conversationId);
  if (!conversation) throw new AppError("Conversation not found", 404);
  const replyRef = await resolveReplyTo(replyTo, conversation._id);
  const message = await repo.createMessage({
    conversation: conversation._id,
    sender: csUserId,
    senderIsCs: true,
    body: text,
    replyTo: replyRef,
  });
  await repo.updateConversation(conversation._id, {
    lastMessageBody: text,
    lastMessageAt: message.createdAt,
    lastSenderIsCs: true,
    csUnread: 0,
    csLastReadAt: message.createdAt,
    $inc: { teacherUnread: 1 },
  });
  return repo.findMessagePopulated(message._id);
};

// ── Message actions (either participant) ────────────────────────────────────

const editMessage = async (messageId, actor, body) => {
  const text = cleanBody(body);
  const { message } = await loadMessageForActor(messageId, actor);
  if (String(message.sender) !== String(actor.userId)) {
    throw new AppError("You can only edit your own messages", 403);
  }
  if (message.deleted) throw new AppError("Cannot edit a deleted message", 400);
  await repo.updateMessage(messageId, { body: text, editedAt: new Date() });
  await refreshLastMessage(message.conversation);
  return repo.findMessagePopulated(messageId);
};

const deleteMessage = async (messageId, actor) => {
  const { message } = await loadMessageForActor(messageId, actor);
  if (String(message.sender) !== String(actor.userId)) {
    throw new AppError("You can only delete your own messages", 403);
  }
  await repo.updateMessage(messageId, {
    deleted: true,
    body: "",
    reactions: [],
    replyTo: null,
  });
  await refreshLastMessage(message.conversation);
  return repo.findMessagePopulated(messageId);
};

const reactToMessage = async (messageId, actor, emoji) => {
  if (!emoji || typeof emoji !== "string") {
    throw new AppError("An emoji is required", 400);
  }
  const { message } = await loadMessageForActor(messageId, actor);
  if (message.deleted) {
    throw new AppError("Cannot react to a deleted message", 400);
  }
  const uid = String(actor.userId);
  const mine = message.reactions.find((r) => String(r.user) === uid);
  // One reaction per user: tapping the same emoji removes it, a different one
  // replaces it.
  let reactions = message.reactions.filter((r) => String(r.user) !== uid);
  if (!mine || mine.emoji !== emoji) {
    reactions.push({ user: actor.userId, emoji });
  }
  await repo.updateMessage(messageId, { reactions });
  return repo.findMessagePopulated(messageId);
};

/** CS-only: wipe a conversation's whole message history. */
const clearConversation = async (conversationId) => {
  const conversation = await repo.findConversationRaw(conversationId);
  if (!conversation) throw new AppError("Conversation not found", 404);
  await repo.deleteMessagesForConversation(conversationId);
  return repo.updateConversation(conversationId, {
    lastMessageBody: "",
    lastMessageAt: null,
    lastSenderIsCs: false,
    csUnread: 0,
    teacherUnread: 0,
  });
};

module.exports = {
  getTeacherThread,
  sendTeacherMessage,
  getTeacherUnread,
  listConversations,
  startConversationForTeacher,
  getCsUnread,
  getConversationForCs,
  sendCsMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  clearConversation,
};
