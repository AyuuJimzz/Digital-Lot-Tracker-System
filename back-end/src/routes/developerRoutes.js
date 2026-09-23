// routes/developerRoutes.js
const express = require("express");
const router = express.Router();

const devSystemController = require("../controllers/developer/devSystemController");
const devDatabaseController = require("../controllers/developer/devDatabaseController");
const devAccountsController = require("../controllers/developer/devAccountsController");
const devMessengerController = require("../controllers/developer/devMessengerController");

const { requireDeveloper, devPinRateLimiter } = devSystemController;

// ── SYSTEM & DIAGNOSTICS ROUTES ──
router.post("/verify-pin", devPinRateLimiter, devSystemController.verifyPin);
router.post("/change-pin", requireDeveloper, devSystemController.changePin);
router.get("/maintenance-status", devSystemController.getMaintenanceStatus);
router.get("/system-state", requireDeveloper, devSystemController.getSystemState);
router.post("/toggle-maintenance", requireDeveloper, devSystemController.toggleMaintenance);
router.get("/api-health", requireDeveloper, devSystemController.getApiHealth);
router.get("/env-health", requireDeveloper, devSystemController.getEnvHealth);
router.post("/global-kill-switch", requireDeveloper, devSystemController.globalKillSwitch);
router.get("/global-kill-switch-status", devSystemController.getGlobalKillSwitchStatus);
router.get("/map-diagnostics", requireDeveloper, devSystemController.getMapDiagnostics);
router.post("/clear-logs", requireDeveloper, devSystemController.clearLogs);

// ── DATABASE & SEED OPERATIONS ──
router.get("/backup-db", requireDeveloper, devDatabaseController.backupDb);
router.get("/db-inspector", requireDeveloper, devDatabaseController.getDbInspector);
router.get("/table-data/:tableName", requireDeveloper, devDatabaseController.getTableData);
router.delete("/table-row", requireDeveloper, devDatabaseController.deleteTableRow);
router.post("/purge-test-data", requireDeveloper, devDatabaseController.purgeTestData);
router.post("/generate-demo-data", requireDeveloper, devDatabaseController.generateDemoData);
router.get("/demo-staff-status", requireDeveloper, devDatabaseController.getDemoStaffStatus);
router.post("/toggle-demo-employee", requireDeveloper, devDatabaseController.toggleDemoEmployee);
router.post("/generate-demo-employees", requireDeveloper, devDatabaseController.generateDemoEmployees);
router.post("/deactivate-all-demo-employees", requireDeveloper, devDatabaseController.deactivateAllDemoEmployees);

// ── ACCOUNTS (ADMINS & EMPLOYEES) ──
router.get("/admins", requireDeveloper, devAccountsController.getAdmins);
router.post("/create-admin", requireDeveloper, devAccountsController.createAdmin);
router.post("/reset-admin-password", requireDeveloper, devAccountsController.resetAdminPassword);
router.put("/update-admin", requireDeveloper, devAccountsController.updateAdmin);
router.delete("/delete-admin/:admin_id", requireDeveloper, devAccountsController.deleteAdmin);

router.get("/employees", requireDeveloper, devAccountsController.getEmployees);
router.post("/create-employee", requireDeveloper, devAccountsController.createEmployee);
router.post("/reset-employee-password", requireDeveloper, devAccountsController.resetEmployeePassword);
router.put("/update-employee", requireDeveloper, devAccountsController.updateEmployee);
router.delete("/delete-employee/:employee_id", requireDeveloper, devAccountsController.deleteEmployee);

// ── MESSENGER INTEGRATION & ALERTS ──
router.post("/test-messenger-alert", requireDeveloper, devMessengerController.testMessengerAlert);
router.get("/messenger-conversations", requireDeveloper, devMessengerController.getMessengerConversations);
router.post("/dismiss-messenger-recipient", requireDeveloper, devMessengerController.dismissMessengerRecipient);
router.post("/restore-messenger-recipients", requireDeveloper, devMessengerController.restoreMessengerRecipients);
router.post("/set-messenger-recipient", requireDeveloper, devMessengerController.setMessengerRecipient);
router.get("/alert-filters", requireDeveloper, devMessengerController.getAlertFilters);
router.post("/toggle-messenger-master-switch", requireDeveloper, devMessengerController.toggleMessengerMasterSwitch);
router.post("/set-alert-filters", requireDeveloper, devMessengerController.setAlertFilters);

module.exports = router;
