const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./shared/config/db");
const {
  startNotificationScheduler,
} = require("./modules/notification/notification.scheduler");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  // Daily duty-reminder / target-reached notification sweeps.
  startNotificationScheduler();
});
