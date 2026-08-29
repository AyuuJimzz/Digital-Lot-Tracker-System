// middleware/maintenanceCheck.js
const fs = require("fs");
const path = require("path");
const configPath = path.join(__dirname, "../../config/system_state.json");

let maintenanceActive = false;

// Helper to load state from disk
function loadMaintenanceState() {
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      maintenanceActive = !!data.maintenanceMode;
    }
  } catch (e) {
    console.error("Failed to load maintenance state:", e);
    maintenanceActive = false;
  }
}

// Initial load
loadMaintenanceState();

module.exports = {
  checkMaintenance: (req, res, next) => {
    // Reload state to ensure sync across cluster/processes
    loadMaintenanceState();

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
