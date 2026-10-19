const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();
const app = require("./app");
const { sendPendingLotReminders } = require("./controllers/lotsController");
const { ensureReminderCutoff } = require("./controllers/lots/lotRemindersController");
const { ready: systemStateReady } = require("./services/systemStateStore");
const schedule = require("node-schedule");

const PORT = process.env.PORT || 5000;

let server;
let reminderJob;
systemStateReady.then(async () => {
  // Record the immutable DB-time cutoff before the API accepts reservations.
  // If this fails, fail startup rather than emailing pre-rollout customers.
  const cutoff = await ensureReminderCutoff();
  console.log(`[Pending Reminder Service] Cutoff: ${cutoff}`);

  server = app.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🚀 SYSTEM IS RUNNING SUCCESSFULLY!`);
    console.log(`==============================================`);
    console.log(`🌐 Frontend (Website):     http://localhost:3000`);
    console.log(`⚙️  Backend (API):         http://localhost:${PORT}`);
    console.log(`🗄️  Database (phpMyAdmin): http://localhost:8080`);
    console.log(`==============================================\n`);
  });
  reminderJob = schedule.scheduleJob("0 * * * *", runReminderJob);
}).catch((error) => {
  const isDbConnError = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST"].includes(error?.code);
  if (isDbConnError) {
    console.error(`\n❌ [Startup Offline]: Cannot connect to MySQL database (${error.code || "ECONNREFUSED"}).`);
    console.error(`👉 Please ensure MySQL is running in XAMPP Control Panel or active on port 3306.\n`);
  } else {
    console.error("❌ Failed to initialize required database state before startup:", error?.message || error);
  }
  process.exit(1);
});

// =======================
// SCHEDULED JOB FOR PENDING LOT REMINDERS
// =======================
// Runs every hour; the controller applies the 12/24-hour eligibility rules.
const runReminderJob = async () => {
  try {
    const mockReq = {};
    const mockRes = {
      json: (data) => {
        if (data && data.totalEmailsSent > 0) {
          console.log(`📧 [Pending Reminder Job]: Sent ${data.totalEmailsSent} reminder email(s).`);
        }
      },
      status: (code) => ({
        json: (data) => {
          // If already logged by lotRemindersController, avoid redundant console spam
          if (data?.code === "ECONNREFUSED" || data?.message?.includes("Database connection offline")) {
            return;
          }
          console.error(`⚠️ [Pending Reminder Job] Status ${code}:`, data?.message || data?.error || data);
        },
      }),
    };

    await sendPendingLotReminders(mockReq, mockRes);
  } catch (error) {
    console.error("⚠️ [Pending Reminder Job Error]:", error?.message || error);
  }
};

const { addDeveloperLog } = require("./services/loggerService");

// =======================
// GRACEFUL SHUTDOWN & CLEANUP (Releases Port 5000 cleanly on Nodemon restart)
// =======================
const shutdown = (signal) => {
  if (!server) {
    if (reminderJob) reminderJob.cancel();
    process.exit(0);
    return;
  }
  server.close(() => {
    if (reminderJob) reminderJob.cancel();
    if (signal === "SIGUSR2") {
      process.kill(process.pid, "SIGUSR2");
    } else {
      process.exit(0);
    }
  });
};

process.once("SIGUSR2", () => shutdown("SIGUSR2"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
