require("dotenv").config();
const app = require("./app");
const { sendPendingLotReminders } = require("./controllers/lotsController");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
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
        console.log("Pending lot reminders completed:", data);
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

// Handle errors
server.on("error", (error) => {
  console.error("Server error:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
