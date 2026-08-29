const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();
const app = require("./app");
const { sendPendingLotReminders } = require("./controllers/lotsController");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(`🚀 SYSTEM IS RUNNING SUCCESSFULLY!`);
  console.log(`==============================================`);
  console.log(`🌐 Frontend (Website):     http://localhost:3000`);
  console.log(`⚙️  Backend (API):         http://localhost:${PORT}`);
  console.log(`🗄️  Database (phpMyAdmin): http://localhost:8080`);
  console.log(`==============================================\n`);
});

// =======================
// SCHEDULED JOB FOR PENDING LOT REMINDERS
// =======================
const schedule = require("node-schedule");

// Runs every hour — checks for lots pending 24+ hours
const reminderJob = schedule.scheduleJob("0 * * * *", async () => {
  try {
    const mockReq = {};
    const mockRes = {
      json: (data) => {
        if (data && data.emailsSent > 0) {
          console.log(`Sent ${data.emailsSent} pending lot reminder email(s).`);
        }
      },
      status: (code) => ({
        json: (data) => {
          console.error(`Error ${code} in pending lot reminders:`, data);
        },
      }),
    };

    await sendPendingLotReminders(mockReq, mockRes);
  } catch (error) {
    console.error("Error in scheduled pending lot reminder job:", error);
  }
});

const { addDeveloperLog } = require("./services/loggerService");
const { sendMessengerAlert } = require("./services/messengerAlertService");

// Handle errors
server.on("error", (error) => {
  console.error("Server error:", error);
  addDeveloperLog(`Server Socket Error: ${error.message || String(error)}`, {
    type: "ERROR",
    role: "SERVER PROCESS",
    device: "Node.js Process",
  });
  sendMessengerAlert("Server Socket Error", error.message || String(error)).catch(() => {});
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  addDeveloperLog(`🚨 Uncaught Exception: ${error.message || String(error)}`, {
    type: "ERROR",
    role: "RUNTIME EXCEPTION",
    device: "Node.js Runtime",
  });
  sendMessengerAlert("🚨 Server Uncaught Exception Crash", error.message || String(error)).catch(() => {});
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  const msg = reason?.message || String(reason || "Unknown Rejection");
  addDeveloperLog(`⚠️ Unhandled Promise Rejection: ${msg}`, {
    type: "ERROR",
    role: "ASYNC PROMISE",
    device: "Node.js Runtime",
  });
  sendMessengerAlert("⚠️ Server Unhandled Promise Rejection", msg).catch(() => {});
});
