const Conversation = require("./conversation.model");
const Message = require("./message.model");

const TEACHER_POPULATE = {
  path: "teacher",
  select: "name email department designation roles",
};

const findConversationByTeacher = (teacherId) =>
  Conversation.findOne({ teacher: teacherId });

const findConversationById = (id) =>
  Conversation.findById(id).populate(TEACHER_POPULATE);

/** Raw (unpopulated) conversation — used for authorization checks. */
const findConversationRaw = (id) => Conversation.findById(id);

const createConversation = (data) => Conversation.create(data);

const updateConversation = (id, data, options = {}) =>
  Conversation.findByIdAndUpdate(id, data, { new: true, ...options }).populate(
    TEACHER_POPULATE
  );

/** All conversations for the CS inbox, most-recently-active first. */
const listConversations = () =>
  Conversation.find({})
    .populate(TEACHER_POPULATE)
    .sort({ lastMessageAt: -1, updatedAt: -1 });

const createMessage = (data) => Message.create(data);

const REPLY_POPULATE = {
  path: "replyTo",
  select: "body senderIsCs deleted sender",
  populate: { path: "sender", select: "name" },
};
const REACTION_POPULATE = { path: "reactions.user", select: "name" };

const listMessages = (conversationId) =>
  Message.find({ conversation: conversationId })
    .populate({ path: "sender", select: "name" })
    .populate(REPLY_POPULATE)
    .populate(REACTION_POPULATE)
    .sort({ createdAt: 1 });

const findMessageById = (id) => Message.findById(id);

const findMessagePopulated = (id) =>
  Message.findById(id)
    .populate({ path: "sender", select: "name" })
    .populate(REPLY_POPULATE)
    .populate(REACTION_POPULATE);

const updateMessage = (id, data) =>
  Message.findByIdAndUpdate(id, data, { new: true });

const deleteMessagesForConversation = (conversationId) =>
  Message.deleteMany({ conversation: conversationId });

/** Most recent message in a conversation (for last-message previews). */
const latestMessage = (conversationId) =>
  Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 });

/** Sum of CS-side unread across every conversation (inbox badge). */
const totalCsUnread = async () => {
  const [row] = await Conversation.aggregate([
    { $group: { _id: null, total: { $sum: "$csUnread" } } },
  ]);
  return row?.total || 0;
};

module.exports = {
  findConversationByTeacher,
  findConversationById,
  findConversationRaw,
  createConversation,
  updateConversation,
  listConversations,
  createMessage,
  listMessages,
  findMessageById,
  findMessagePopulated,
  updateMessage,
  deleteMessagesForConversation,
  latestMessage,
  totalCsUnread,
};
