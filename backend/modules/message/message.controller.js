const catchAsync = require("../../shared/utils/catchAsync");
const AppError = require("../../shared/utils/AppError");
const messageService = require("./message.service");

// CS uses the inbox endpoints, not the single-thread ones — guard so a CS
// account doesn't accidentally open a "teacher" conversation against itself.
const assertTeacher = (req) => {
  if (req.user.activeRole === "cs") {
    throw new AppError("CS should use the message inbox, not a thread", 400);
  }
};

// ── Teacher side ──
const getMyThread = catchAsync(async (req, res) => {
  assertTeacher(req);
  const data = await messageService.getTeacherThread(req.user.id);
  res.status(200).json({ success: true, data });
});

const sendMyMessage = catchAsync(async (req, res) => {
  assertTeacher(req);
  const message = await messageService.sendTeacherMessage(
    req.user.id,
    req.body?.body,
    req.body?.replyTo
  );
  res.status(201).json({ success: true, data: message });
});

const getMyUnread = catchAsync(async (req, res) => {
  assertTeacher(req);
  const count = await messageService.getTeacherUnread(req.user.id);
  res.status(200).json({ success: true, data: { count } });
});

// ── CS side ──
const listConversations = catchAsync(async (_req, res) => {
  const conversations = await messageService.listConversations();
  res
    .status(200)
    .json({ success: true, count: conversations.length, data: conversations });
});

const getCsUnread = catchAsync(async (_req, res) => {
  const count = await messageService.getCsUnread();
  res.status(200).json({ success: true, data: { count } });
});

const startConversation = catchAsync(async (req, res) => {
  const conversation = await messageService.startConversationForTeacher(
    req.body?.teacherId
  );
  res.status(201).json({ success: true, data: conversation });
});

const getConversation = catchAsync(async (req, res) => {
  const data = await messageService.getConversationForCs(req.params.id);
  res.status(200).json({ success: true, data });
});

const replyConversation = catchAsync(async (req, res) => {
  const message = await messageService.sendCsMessage(
    req.params.id,
    req.user.id,
    req.body?.body,
    req.body?.replyTo
  );
  res.status(201).json({ success: true, data: message });
});

// ── Message actions (either participant) ──
const actorOf = (req) => ({
  userId: req.user.id,
  activeRole: req.user.activeRole,
});

const editMessage = catchAsync(async (req, res) => {
  const message = await messageService.editMessage(
    req.params.id,
    actorOf(req),
    req.body?.body
  );
  res.status(200).json({ success: true, data: message });
});

const deleteMessage = catchAsync(async (req, res) => {
  const message = await messageService.deleteMessage(req.params.id, actorOf(req));
  res.status(200).json({ success: true, data: message });
});

const reactMessage = catchAsync(async (req, res) => {
  const message = await messageService.reactToMessage(
    req.params.id,
    actorOf(req),
    req.body?.emoji
  );
  res.status(200).json({ success: true, data: message });
});

const clearConversation = catchAsync(async (req, res) => {
  const conversation = await messageService.clearConversation(req.params.id);
  res.status(200).json({ success: true, data: conversation });
});

module.exports = {
  getMyThread,
  sendMyMessage,
  getMyUnread,
  listConversations,
  getCsUnread,
  startConversation,
  getConversation,
  replyConversation,
  editMessage,
  deleteMessage,
  reactMessage,
  clearConversation,
};
