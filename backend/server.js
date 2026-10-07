const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const app = require("./app");
const connectDB = require("./shared/config/db");
const {
  startNotificationScheduler,
} = require("./modules/notification/notification.scheduler");
const {
  startMailDispatcher,
} = require("./modules/mail/mail.dispatcher");
const { startPushDispatcher } = require("./modules/push/push.dispatcher");
const { attachRealtime } = require("./shared/realtime");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = http.createServer(app);
  // Live "duties changed" pushes to open pages (no-op if socket.io is absent).
  attachRealtime(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  // Daily duty-reminder / target-reached notification sweeps.
  startNotificationScheduler();
  // Drains the email outbox written by notification.emitter. Defaults to the
  // `console` transport, so nothing leaves the machine until MAIL_TRANSPORT is
  // pointed at a real mail server.
  startMailDispatcher();
  // Drains the phone-push outbox (same emitter). Defaults to the `console`
  // transport; PUSH_TRANSPORT=expo sends through Expo's push service.
  startPushDispatcher();
});
