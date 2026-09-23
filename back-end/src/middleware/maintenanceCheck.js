// middleware/maintenanceCheck.js
const { getSystemState } = require("../services/systemStateStore");

let maintenanceActive = false;

// Helper to load state from disk
module.exports = {
  checkMaintenance: (req, res, next) => {
    maintenanceActive = !!getSystemState().maintenanceMode;

    if (maintenanceActive) {
      // Bypass developer routes and active developer sessions
      const isDevRoute = req.path.startsWith("/api/developer");
      const isDevSession = req.session && req.session.isDeveloper;
      if (!isDevRoute && !isDevSession) {
        return res.status(503).json({
          maintenance: true,
          message: "The application is currently undergoing scheduled maintenance. Please try again later.",
        });
      }
    }
    next();
  },
  setMaintenanceState: (active) => {
    maintenanceActive = active;
  }
};
