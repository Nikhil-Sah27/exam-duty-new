const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./shared/config/db");
const {
  startNotificationScheduler,
} = require("./modules/notification/notification.scheduler");
const {
  startMailDispatcher,
} = require("./modules/mail/mail.dispatcher");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  // Daily duty-reminder / target-reached notification sweeps.
  startNotificationScheduler();
  // Drains the email outbox written by notification.emitter. Defaults to the
  // `console` transport, so nothing leaves the machine until MAIL_TRANSPORT is
  // pointed at a real mail server.
  startMailDispatcher();
});
