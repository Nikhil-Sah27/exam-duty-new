const AppError = require("../../shared/utils/AppError");
const userRepository = require("../user/user.repository");
const notificationEmitter = require("../notification/notification.emitter");

const ROLES = ["cs", "dcs", "rs", "invigilator"];

/**
 * Resolve the recipient list for a broadcast.
 *   - `all`      → every active user (excluding the sender)
 *   - `role`     → every active user whose roles ∋ any of `roles`
 *   - `specific` → the exact `userIds` list (no role filtering)
 * Returns an array of ObjectIds.
 */
const resolveRecipients = async ({ audience, roles, userIds }, senderId) => {
  if (audience === "all") {
    const ids = await userRepository.findActiveIds();
    return ids.filter((id) => id.toString() !== senderId);
  }

  if (audience === "role") {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new AppError("At least one role is required", 400);
    }
    const invalid = roles.filter((r) => !ROLES.includes(r));
    if (invalid.length > 0) {
      throw new AppError(`Invalid role(s): ${invalid.join(", ")}`, 400);
    }
    const ids = await userRepository.findActiveIds(roles);
    return ids.filter((id) => id.toString() !== senderId);
  }

  if (audience === "specific") {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError("At least one recipient is required", 400);
    }
    return userIds;
  }

  throw new AppError(
    `Unknown audience "${audience}" — expected all | role | specific`,
    400,
  );
};

const sendBroadcast = async ({ audience, roles, userIds, title, message }, senderId) => {
  const cleanTitle = (title || "").trim();
  const cleanMessage = (message || "").trim();
  if (!cleanTitle) throw new AppError("Title is required", 400);
  if (!cleanMessage) throw new AppError("Message is required", 400);

  const recipients = await resolveRecipients(
    { audience, roles, userIds },
    senderId,
  );

  if (recipients.length === 0) {
    return { sent: 0, recipients: [] };
  }

  await notificationEmitter.emitToMany("announcement", {
    recipients,
    data: { title: cleanTitle, message: cleanMessage },
  });

  return { sent: recipients.length, recipients };
};

module.exports = { sendBroadcast };
