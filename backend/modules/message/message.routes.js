const express = require("express");
const controller = require("./message.controller");
const protect = require("../../shared/middleware/auth");
const requireRole = require("../../shared/middleware/requireRole");

const router = express.Router();

router.use(protect);

// Teacher side — each teacher has a single thread with CS (their own).
router.get("/thread", controller.getMyThread);
router.post("/thread", controller.sendMyMessage);
router.get("/thread/unread", controller.getMyUnread);

// CS inbox — all conversations. `/conversations/unread` is declared before the
// `:id` param route so it isn't captured as an id.
router.get("/conversations", requireRole("cs"), controller.listConversations);
router.get("/conversations/unread", requireRole("cs"), controller.getCsUnread);
// Static POST path must precede POST `/conversations/:id` so "start" isn't an id.
router.post("/conversations/start", requireRole("cs"), controller.startConversation);
router.get("/conversations/:id", requireRole("cs"), controller.getConversation);
router.post("/conversations/:id", requireRole("cs"), controller.replyConversation);
router.delete(
  "/conversations/:id/messages",
  requireRole("cs"),
  controller.clearConversation
);

// Message actions — usable by either participant (authorized per-message in the
// service). Namespaced under /msg so they don't collide with the routes above.
router.patch("/msg/:id", controller.editMessage);
router.delete("/msg/:id", controller.deleteMessage);
router.put("/msg/:id/reaction", controller.reactMessage);

module.exports = router;
