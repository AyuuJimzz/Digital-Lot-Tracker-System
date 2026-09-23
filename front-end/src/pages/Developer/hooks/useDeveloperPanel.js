import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { showToast } from "../../../components/GlobalToast";
import { API_BASE_URL } from "../../../config/api";

const useDeveloperPanel = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Dashboard states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logs, setLogs] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Admin Provisioning states
  const [admins, setAdmins] = useState([]);
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState("");
  const [adminError, setAdminError] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ text: "", isError: false });

  // Admin Edit & Delete states
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: "", isError: false });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Live Database Inspector state
  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);

  // Table Data Explorer states
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");

  // Change Developer PIN states
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmNewPinInput, setConfirmNewPinInput] = useState("");
  const [showPinFields, setShowPinFields] = useState(false);
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [changePinMsg, setChangePinMsg] = useState({ text: "", isError: false });
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  // Map & Lot Diagnostics state
  const [mapDiag, setMapDiag] = useState(null);
  const [mapDiagLoading, setMapDiagLoading] = useState(false);
  const [mapDiagFilter, setMapDiagFilter] = useState("ALL");
  const [showFlaggedLotsList, setShowFlaggedLotsList] = useState(true);

  // Accounts Tab Switcher ("ADMINS" | "EMPLOYEES")
  const [accountTab, setAccountTab] = useState("ADMINS");

  // Employee Directory & Override states
  const [employees, setEmployees] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empFormLoading, setEmpFormLoading] = useState(false);
  const [empFormError, setEmpFormError] = useState("");
  const [empFormSuccess, setEmpFormSuccess] = useState("");

  // Selected Employee Modal states
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editEmpFirstName, setEditEmpFirstName] = useState("");
  const [editEmpLastName, setEditEmpLastName] = useState("");
  const [editEmpEmail, setEditEmpEmail] = useState("");
  const [empNewPassword, setEmpNewPassword] = useState("");
  const [showEmpNewPassword, setShowEmpNewPassword] = useState(false);
  const [empModalLoading, setEmpModalLoading] = useState(false);
  const [empModalMsg, setEmpModalMsg] = useState({ text: "", isError: false });
  const [showDeleteEmpConfirm, setShowDeleteEmpConfirm] = useState(false);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);

  // Sidebar Layout Navigation state ("SYSTEM" | "DATABASE" | "MAP" | "ACCOUNTS")
  const [activeSidebarTab, setActiveSidebarTab] = useState("SYSTEM");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Row deletion state for Table Explorer
  const [rowToDelete, setRowToDelete] = useState(null);
  const [rowDeleteLoading, setRowDeleteLoading] = useState(false);

  // Test data purge state
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeSuccessMsg, setPurgeSuccessMsg] = useState("");

  // Capstone Demo Seed Data Generator state
  const [showDemoDataModal, setShowDemoDataModal] = useState(false);
  const [demoDataCount, setDemoDataCount] = useState(6);
  const [demoDataLoading, setDemoDataLoading] = useState(false);
  const [demoDataSuccessMsg, setDemoDataSuccessMsg] = useState("");
  const [demoModalTab, setDemoModalTab] = useState("transactions"); // "transactions" | "employees"
  const [demoEmployeesList, setDemoEmployeesList] = useState([
    { name: "Sarah Mae Santos", email: "sarah.santos@goldendragon.com", password: "Password123!", role: "Staff / Employee" },
    { name: "Mark Anthony Reyes", email: "mark.reyes@goldendragon.com", password: "Password123!", role: "Staff / Employee" },
    { name: "Eduardo Ramos", email: "eduardo.ramos@goldendragon.com", password: "Password123!", role: "Staff / Employee" },
  ]);
  const [demoEmpLoading, setDemoEmpLoading] = useState(false);
  const [demoEmpSuccessMsg, setDemoEmpSuccessMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [showDemoPasswords, setShowDemoPasswords] = useState(true);

  // API Health & Routes Monitor states
  const [apiHealthData, setApiHealthData] = useState(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(false);
  const [apiDomainFilter, setApiDomainFilter] = useState("ALL");

  // Environment (.env) Health Inspector states
  const [envHealthData, setEnvHealthData] = useState(null);
  const [envHealthLoading, setEnvHealthLoading] = useState(false);
  const [envCategoryFilter, setEnvCategoryFilter] = useState("ALL");

  // Global Kill Switch states
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [killSwitchSuccessMsg, setKillSwitchSuccessMsg] = useState("");
  const [lastKillSwitchTime, setLastKillSwitchTime] = useState(null);

  // Separated Log Category Modal states
  const [selectedLogCategory, setSelectedLogCategory] = useState(null); // 'AUTH' | 'SECURITY' | 'DATABASE' | 'SYSTEM'
  const [logModalSearch, setLogModalSearch] = useState("");
  const [showClearCategoryConfirm, setShowClearCategoryConfirm] = useState(false);
  const [clearCategoryLoading, setClearCategoryLoading] = useState(false);

  // Facebook Messenger Alert states
  const [messengerTestLoading, setMessengerTestLoading] = useState(false);
  const [messengerTestMsg, setMessengerTestMsg] = useState({ text: "", isError: false });
  const [messengerRecipients, setMessengerRecipients] = useState([]);
  const [fetchRecipientsLoading, setFetchRecipientsLoading] = useState(false);

  // Helper to attach Developer PIN in request headers
  const getDevHeaders = useCallback(() => {
    const storedPin = sessionStorage.getItem("devPin");
    return storedPin ? { "x-developer-pin": storedPin } : {};
  }, []);

  const [dismissedCount, setDismissedCount] = useState(0);
  const [alertFilters, setAlertFilters] = useState({
    criticalErrors: true,
    reservations: true,
    authSecurity: true,
    systemChanges: true,
  });

  const [messengerMasterEnabled, setMessengerMasterEnabled] = useState(true);

  const fetchAlertFilters = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/alert-filters`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data?.success) {
        if (res.data.filters) setAlertFilters(res.data.filters);
        if (res.data.messengerAlertsEnabled !== undefined) {
          setMessengerMasterEnabled(Boolean(res.data.messengerAlertsEnabled));
        }
      }
    } catch (_) {}
  }, [getDevHeaders]);

  const handleToggleMessengerMaster = async () => {
    const nextState = !messengerMasterEnabled;
    setMessengerMasterEnabled(nextState);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/toggle-messenger-master-switch`,
        { enabled: nextState },
        { headers: getDevHeaders(), withCredentials: true }
      );
      if (res.data?.success) {
        setMessengerTestMsg({
          text: `🔔 ${res.data.message}`,
          isError: false,
        });
        fetchSystemState();
      }
    } catch (err) {
      setMessengerTestMsg({
        text: "❌ Failed to toggle master Messenger switch",
        isError: true,
      });
    }
  };

  const handleToggleFilter = async (filterKey) => {
    const updated = {
      ...alertFilters,
      [filterKey]: !alertFilters[filterKey],
    };
    setAlertFilters(updated);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/set-alert-filters`,
        { filters: updated },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
      if (res.data?.success) {
        setMessengerTestMsg({
          text: `✅ Alert Category '${filterKey}' is now ${updated[filterKey] ? "ACTIVE" : "MUTED"}`,
          isError: false,
        });
        fetchSystemState();
      }
    } catch (err) {
      setMessengerTestMsg({
        text: "❌ Failed to save alert filter preferences",
        isError: true,
      });
    }
  };


  const handleDismissRecipient = async (recipient) => {
    if (!window.confirm(`Hide "${recipient.name}" from this scan list?`)) return;
    setMessengerTestLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/dismiss-messenger-recipient`,
        { psid: recipient.id, name: recipient.name },
        { headers: getDevHeaders(), withCredentials: true }
      );
      if (res.data.success) {
        setMessengerTestMsg({ text: `🗑️ ${res.data.message}`, isError: false });
        setMessengerRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
        setDismissedCount((c) => c + 1);
        fetchEnvHealth();
        fetchSystemState();
      }
    } catch (err) {
      setMessengerTestMsg({ text: "❌ Failed to dismiss contact", isError: true });
    } finally {
      setMessengerTestLoading(false);
    }
  };

  const handleRestoreRecipients = async () => {
    setMessengerTestLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/restore-messenger-recipients`,
        {},
        { headers: getDevHeaders(), withCredentials: true }
      );
      if (res.data.success) {
        setMessengerTestMsg({ text: `🔄 ${res.data.message}`, isError: false });
        setDismissedCount(0);
        fetchMessengerRecipients();
      }
    } catch (err) {
      setMessengerTestMsg({ text: "❌ Failed to restore contacts", isError: true });
    } finally {
      setMessengerTestLoading(false);
    }
  };

  const fetchMessengerRecipients = async () => {
    setFetchRecipientsLoading(true);
    setMessengerTestMsg({ text: "", isError: false });
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/messenger-conversations`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setMessengerRecipients(res.data.recipients || []);
        if (res.data.dismissedCount !== undefined) {
          setDismissedCount(res.data.dismissedCount);
        }
        if ((res.data.recipients || []).length === 0) {
          setMessengerTestMsg({
            text: "No recent messages found on your Facebook Page. Please send a message (e.g. 'hello') to your Golden Dragon Page first!",
            isError: true,
          });
        }
      }
    } catch (err) {
      setMessengerTestMsg({
        text: err.response?.data?.error || "Failed to fetch conversations from Facebook Page.",
        isError: true,
      });
    } finally {
      setFetchRecipientsLoading(false);
    }
  };

  const handleToggleRecipient = async (recipient) => {
    setMessengerTestLoading(true);
    setMessengerTestMsg({ text: "", isError: false });
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/set-messenger-recipient`,
        { psid: recipient.id, name: recipient.name, action: "toggle" },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
      if (res.data.success) {
        const activePsids = res.data.activePsids || [];
        setMessengerTestMsg({ text: "✅ " + res.data.message, isError: false });
        setMessengerRecipients((prev) =>
          prev.map((r) => ({
            ...r,
            isCurrent: activePsids.includes(r.id),
          }))
        );
        fetchEnvHealth();
        fetchSystemState();
      }
    } catch (err) {
      setMessengerTestMsg({
        text: "❌ " + (err.response?.data?.message || err.response?.data?.error || "Failed to update recipient"),
        isError: true,
      });
    } finally {
      setMessengerTestLoading(false);
    }
  };

  // Clear specific log category
  const handleClearCategoryLogs = async (categoryType) => {
    setClearCategoryLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/developer/clear-logs`, { type: categoryType }, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setLogs(res.data.logs || []);
        setShowClearCategoryConfirm(false);
      }
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearCategoryLoading(false);
    }
  };

  // Fetch system state & logs
  const fetchSystemState = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data) {
        setMaintenanceMode(res.data.maintenanceMode);
        setLogs(res.data.logs || []);
        if (res.data.authRevocationTimestamp) {
          setLastKillSwitchTime(res.data.authRevocationTimestamp);
        }
      }
    } catch (err) {}
  }, [getDevHeaders]);

  // Trigger Emergency Global Kill Switch (Force Logout All)
  const handleTriggerKillSwitch = async () => {
    setKillSwitchLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/developer/global-kill-switch`, {}, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setKillSwitchSuccessMsg("Emergency Kill Switch Triggered! All active sessions have been invalidated immediately.");
        setLastKillSwitchTime(res.data.timestamp);
        fetchSystemState();
        setTimeout(() => {
          setShowKillSwitchModal(false);
          setKillSwitchSuccessMsg("");
        }, 2200);
      }
    } catch (err) {
      console.error("Failed to trigger kill switch:", err);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  // Fetch API health diagnostics
  const fetchApiHealth = useCallback(async () => {
    setApiHealthLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/api-health`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setApiHealthData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch API health:", err);
      setApiHealthData({ error: err.message, endpoints: [], healthyCount: 0, totalEndpoints: 0 });
    } finally {
      setApiHealthLoading(false);
    }
  }, [getDevHeaders]);

  // Auto-fetch API health when ENDPOINTS tab is selected
  useEffect(() => {
    if (activeSidebarTab === "ENDPOINTS" && !apiHealthData && !apiHealthLoading) {
      fetchApiHealth();
    }
  }, [activeSidebarTab, apiHealthData, apiHealthLoading, fetchApiHealth]);

  // Fetch environment variables health
  const fetchEnvHealth = useCallback(async () => {
    setEnvHealthLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/env-health`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setEnvHealthData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch environment variables health:", err);
      setEnvHealthData({ error: err.message, groups: [], healthyCount: 0, totalVars: 0 });
    } finally {
      setEnvHealthLoading(false);
    }
  }, [getDevHeaders]);

  // Auto-fetch when ENV tab is selected
  useEffect(() => {
    if (activeSidebarTab === "ENV" && !envHealthData && !envHealthLoading) {
      fetchEnvHealth();
    }
  }, [activeSidebarTab, envHealthData, envHealthLoading, fetchEnvHealth]);

  // Fetch admin accounts list
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/admins`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setAdmins(res.data.admins || []);
      }
    } catch (err) {
      // Ignored
    }
  }, [getDevHeaders]);

  // Fetch employee accounts list
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/employees`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      // Ignored
    }
  }, [getDevHeaders]);

  // Fetch live database table stats & latency
  const fetchDbStats = useCallback(async () => {
    setDbStatsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/db-inspector`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setDbStats(res.data);
      }
    } catch (err) {
      console.error("Failed to inspect database tables:", err);
    } finally {
      setDbStatsLoading(false);
    }
  }, [getDevHeaders]);

  // Fetch map & lot coordinate diagnostics
  const fetchMapDiagnostics = useCallback(async () => {
    setMapDiagLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/map-diagnostics`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setMapDiag(res.data);
      }
    } catch (err) {
      console.error("Failed to run map diagnostics:", err);
    } finally {
      setMapDiagLoading(false);
    }
  }, [getDevHeaders]);

  // Check if developer session is already active (runs once on mount)
  useEffect(() => {
    let isMounted = true;
    const checkState = async () => {
      const storedPin = sessionStorage.getItem("devPin");
      if (!storedPin) {
        if (isMounted) setIsCheckingAuth(false);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: { "x-developer-pin": storedPin },
          withCredentials: true,
        });
        if (isMounted) {
          setMaintenanceMode(res.data.maintenanceMode);
          setLogs(res.data.logs || []);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          // Fetch admins, employees, database stats, and map diagnostics
          fetchAdmins();
          fetchEmployees();
          fetchDbStats();
          fetchMapDiagnostics();
          fetchAlertFilters();
        }
      } catch (err) {
        sessionStorage.removeItem("devPin");
        if (isMounted) {
          setIsAuthorized(false);
          setIsCheckingAuth(false);
        }
      }
    };
    checkState();
    return () => {
      isMounted = false;
    };
  }, [fetchAdmins, fetchEmployees, fetchDbStats, fetchMapDiagnostics, fetchAlertFilters]);

  // Poll system logs when authorized
  useEffect(() => {
    if (!isAuthorized) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(res.data.logs || []);
      } catch (err) {
        // Session expired or disconnected
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthorized, getDevHeaders]);

  // Handle PIN submit
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) return;
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/verify-pin`,
        { pin: cleanPin },
        { withCredentials: true }
      );
      if (res.data.success) {
        sessionStorage.setItem("devPin", cleanPin);
        setIsAuthorized(true);
        // Load initial state
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: { "x-developer-pin": cleanPin },
          withCredentials: true,
        });
        setMaintenanceMode(stateRes.data.maintenanceMode);
        setLogs(stateRes.data.logs || []);
        fetchAdmins();
        fetchEmployees();
        fetchDbStats();
        fetchMapDiagnostics();
      }
    } catch (err) {
      sessionStorage.removeItem("devPin");
      setError(err.response?.data?.error || "Incorrect Developer PIN");
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Admin Submit
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!adminFullName.trim() || !adminEmail.trim() || !adminPassword) {
      setAdminError("Please fill in all admin account fields");
      return;
    }

    if (adminPassword.length < 6) {
      setAdminError("Password must be at least 6 characters");
      return;
    }

    setAdminLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/create-admin`,
        {
          full_name: adminFullName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
      if (res.data.success) {
        setAdminSuccess(`Admin account created for ${adminEmail.trim()}`);
        setAdminFullName("");
        setAdminEmail("");
        setAdminPassword("");
        fetchAdmins();
        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setAdminError(err.response?.data?.error || "Failed to create admin account");
    } finally {
      setAdminLoading(false);
    }
  };

  // Reset / Override Admin Password
  const handleResetAdminPassword = async (e) => {
    e.preventDefault();
    if (!selectedAdmin || !resetPasswordVal.trim()) return;
    if (resetPasswordVal.length < 6) {
      setResetMsg({ text: "Password must be at least 6 characters", isError: true });
      return;
    }

    setResetLoading(true);
    setResetMsg({ text: "", isError: false });

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/reset-admin-password`,
        {
          admin_id: selectedAdmin.admin_id,
          new_password: resetPasswordVal,
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setResetMsg({ text: "Password successfully updated in database!", isError: false });
        setResetPasswordVal("");
        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setResetMsg({ text: err.response?.data?.error || "Failed to update password", isError: true });
    } finally {
      setResetLoading(false);
    }
  };

  // Open Edit Mode for selected admin
  const handleStartEdit = (admin) => {
    setIsEditingAdmin(true);
    setEditFullName(admin.full_name || "");
    setEditEmail(admin.email || "");
    setEditMsg({ text: "", isError: false });
  };

  // Save Edit (Update Full Name & Email)
  const handleSaveEditAdmin = async (e) => {
    e.preventDefault();
    if (!selectedAdmin || !editFullName.trim() || !editEmail.trim()) return;

    setEditLoading(true);
    setEditMsg({ text: "", isError: false });

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/developer/update-admin`,
        {
          admin_id: selectedAdmin.admin_id,
          full_name: editFullName.trim(),
          email: editEmail.trim(),
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEditMsg({ text: "Profile updated successfully!", isError: false });
        setSelectedAdmin((prev) => ({
          ...prev,
          full_name: editFullName.trim(),
          email: editEmail.trim(),
        }));
        await fetchAdmins();

        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
        setTimeout(() => setIsEditingAdmin(false), 1000);
      }
    } catch (err) {
      setEditMsg({ text: err.response?.data?.error || "Failed to update admin profile", isError: true });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Admin Account
  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    setDeleteLoading(true);

    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/developer/delete-admin/${selectedAdmin.admin_id}`,
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setShowDeleteConfirm(false);
        setSelectedAdmin(null);
        await fetchAdmins();

        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to delete admin account", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Trigger Database Backup download
  const handleBackupDownload = async () => {
    setDbLoading(true);
    try {
      const response = await axios({
        url: `${API_BASE_URL}/api/developer/backup-db`,
        method: "GET",
        headers: getDevHeaders(),
        responseType: "blob", // critical for raw files
        withCredentials: true,
      });

      // Extract filename from header or use default
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `golden_dragon_backup_${dateStr}.sql`;

      // Create browser link to trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      // Refresh state logs immediately
      const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      setLogs(stateRes.data.logs || []);
    } catch (err) {
      showToast("Failed to download database backup: " + (err.message || "Server Error"), "error");
    } finally {
      setDbLoading(false);
    }
  };

  // Toggle Maintenance Mode
  const handleToggleMaintenance = async () => {
    setToggleLoading(true);
    const nextMode = !maintenanceMode;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/toggle-maintenance`,
        { maintenanceMode: nextMode },
        { 
          headers: getDevHeaders(),
          withCredentials: true 
        }
      );
      setMaintenanceMode(res.data.maintenanceMode);

      // Refresh logs
      const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      setLogs(stateRes.data.logs || []);
    } catch (err) {
      showToast("Failed to toggle maintenance mode: " + (err.response?.data?.error || "Error"), "error");
    } finally {
      setToggleLoading(false);
    }
  };


  // Open Table Data Explorer Modal
  const handleOpenTableData = async (tableName) => {
    setSelectedTable(tableName);
    setTableData(null);
    setTableDataLoading(true);
    setTableSearchQuery("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/table-data/${tableName}`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setTableData(res.data);
      }
    } catch (err) {
      console.error("Failed to load table rows:", err);
    } finally {
      setTableDataLoading(false);
    }
  };

  // Export table rows as JSON
  const handleDownloadTableJson = (tableName, rows) => {
    if (!rows || rows.length === 0) return;
    const jsonStr = JSON.stringify(rows, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tableName}_records_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Delete single table row handler
  const handleDeleteRowConfirm = async () => {
    if (!rowToDelete) return;
    setRowDeleteLoading(true);
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/developer/table-row`, {
        data: {
          tableName: rowToDelete.tableName,
          primaryKey: rowToDelete.primaryKey,
          primaryKeyValue: rowToDelete.primaryKeyValue,
        },
        headers: getDevHeaders(),
        withCredentials: true,
      });

      if (res.data.success) {
        setRowToDelete(null);
        // Refresh active table
        await handleOpenTableData(rowToDelete.tableName);
        // Refresh DB metrics & logs
        fetchDbStats();
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to delete record", "error");
    } finally {
      setRowDeleteLoading(false);
    }
  };

  // Purge all test data (customers & transactions) handler
  const handlePurgeTestDataConfirm = async () => {
    setPurgeLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/purge-test-data`,
        {},
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setShowPurgeModal(false);
        setPurgeSuccessMsg(res.data.message);
        fetchDbStats();
        // If modal was open, refresh or close
        if (selectedTable) {
          handleOpenTableData(selectedTable);
        }
        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to purge test data", "error");
    } finally {
      setPurgeLoading(false);
    }
  };

  // Generate Capstone Demo Seed Data handler
  const handleGenerateDemoDataConfirm = async () => {
    setDemoDataLoading(true);
    setDemoDataSuccessMsg("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/generate-demo-data`,
        { count: demoDataCount },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoDataSuccessMsg(res.data.message);
        fetchDbStats();
        // If modal was open, refresh table
        if (selectedTable) {
          handleOpenTableData(selectedTable);
        }
        // Refresh logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to generate demo data", "error");
    } finally {
      setDemoDataLoading(false);
    }
  };

  // Fetch live status of demo staff accounts
  const fetchDemoStaffStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/demo-staff-status`, {
        headers: getDevHeaders(),
        withCredentials: true,
      });
      if (res.data.success && Array.isArray(res.data.staff)) {
        setDemoEmployeesList(res.data.staff);
      }
    } catch (e) {
      // Fallback: keep existing list
    }
  }, [getDevHeaders]);

  // Toggle single demo employee account (Activate / Deactivate)
  const handleToggleDemoEmployee = async (email, action) => {
    setDemoEmpLoading(true);
    setDemoEmpSuccessMsg("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/toggle-demo-employee`,
        { email, action },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmpSuccessMsg(res.data.message);
        fetchDemoStaffStatus();
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to toggle demo employee account", "error");
    } finally {
      setDemoEmpLoading(false);
    }
  };

  // Activate all demo staff accounts
  const handleGenerateDemoEmployees = async () => {
    setDemoEmpLoading(true);
    setDemoEmpSuccessMsg("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/generate-demo-employees`,
        {},
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmployeesList(res.data.employees || []);
        setDemoEmpSuccessMsg(res.data.message || "All demo staff accounts activated successfully!");
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to activate demo employee accounts", "error");
    } finally {
      setDemoEmpLoading(false);
    }
  };

  // Deactivate all demo staff accounts
  const handleDeactivateAllDemoEmployees = async () => {
    setDemoEmpLoading(true);
    setDemoEmpSuccessMsg("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/deactivate-all-demo-employees`,
        {},
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmpSuccessMsg(res.data.message || "All demo staff accounts deactivated.");
        fetchDemoStaffStatus();
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to deactivate demo employee accounts", "error");
    } finally {
      setDemoEmpLoading(false);
    }
  };

  // Quick clipboard copy helper
  const handleCopyText = (key, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }
  };

  // Change Developer Security PIN handler
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setChangePinMsg({ text: "", isError: false });

    const curr = currentPinInput.trim();
    const nextPin = newPinInput.trim();
    const conf = confirmNewPinInput.trim();

    if (!curr || !nextPin || !conf) {
      setChangePinMsg({ text: "Please fill in all PIN fields", isError: true });
      return;
    }

    if (nextPin.length < 4) {
      setChangePinMsg({ text: "New PIN must be at least 4 characters long", isError: true });
      return;
    }

    if (nextPin !== conf) {
      setChangePinMsg({ text: "New PIN and Confirmation do not match", isError: true });
      return;
    }

    setChangePinLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/change-pin`,
        {
          currentPin: curr,
          newPin: nextPin,
          confirmNewPin: conf,
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        sessionStorage.setItem("devPin", nextPin);
        setChangePinMsg({ text: "Developer Security PIN updated successfully!", isError: false });
        setCurrentPinInput("");
        setNewPinInput("");
        setConfirmNewPinInput("");

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: { "x-developer-pin": nextPin },
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
        setTimeout(() => {
          setIsChangePinOpen(false);
          setChangePinMsg({ text: "", isError: false });
        }, 2000);
      }
    } catch (err) {
      setChangePinMsg({
        text: err.response?.data?.error || "Failed to update Developer PIN",
        isError: true,
      });
    } finally {
      setChangePinLoading(false);
    }
  };

  // Handle Create Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setEmpFormError("");
    setEmpFormSuccess("");

    if (!empFirstName.trim() || !empLastName.trim() || !empEmail.trim() || !empPassword.trim()) {
      setEmpFormError("First Name, Last Name, Email, and Password are required");
      return;
    }

    if (empPassword.trim().length < 6) {
      setEmpFormError("Password must be at least 6 characters long");
      return;
    }

    setEmpFormLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/create-employee`,
        {
          first_name: empFirstName.trim(),
          last_name: empLastName.trim(),
          email: empEmail.trim(),
          password: empPassword.trim(),
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpFormSuccess(res.data.message || "Employee account created successfully!");
        setEmpFirstName("");
        setEmpLastName("");
        setEmpEmail("");
        setEmpPassword("");
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setEmpFormError(err.response?.data?.error || "Failed to create employee account");
    } finally {
      setEmpFormLoading(false);
    }
  };

  // Open Employee Modal
  const handleOpenEmployeeModal = (emp) => {
    setSelectedEmployee(emp);
    setEditEmpFirstName(emp.first_name || "");
    setEditEmpLastName(emp.last_name || "");
    setEditEmpEmail(emp.email || "");
    setEmpNewPassword("");
    setShowEmpNewPassword(false);
    setEmpModalMsg({ text: "", isError: false });
    setShowDeleteEmpConfirm(false);
    setIsEditingEmployee(false);
  };

  // Close Employee Modal
  const handleCloseEmployeeModal = () => {
    setSelectedEmployee(null);
    setEmpModalMsg({ text: "", isError: false });
    setShowDeleteEmpConfirm(false);
    setIsEditingEmployee(false);
  };

  // Generate random strong password for employee override
  const handleGenerateRandomEmpPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEmpNewPassword(generated);
    setShowEmpNewPassword(true);
  };

  // Reset / Override Employee Password
  const handleResetEmployeePassword = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!empNewPassword.trim() || empNewPassword.trim().length < 6) {
      setEmpModalMsg({ text: "New password must be at least 6 characters long", isError: true });
      return;
    }

    setEmpModalLoading(true);
    setEmpModalMsg({ text: "", isError: false });
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/reset-employee-password`,
        {
          employee_id: selectedEmployee.employee_id,
          newPassword: empNewPassword.trim(),
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpModalMsg({ text: "Employee password successfully overridden!", isError: false });
        setEmpNewPassword("");

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to override employee password",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };

  // Update Employee Profile
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!editEmpFirstName.trim() || !editEmpLastName.trim() || !editEmpEmail.trim()) {
      setEmpModalMsg({ text: "First Name, Last Name, and Email are required", isError: true });
      return;
    }

    setEmpModalLoading(true);
    setEmpModalMsg({ text: "", isError: false });
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/developer/update-employee`,
        {
          employee_id: selectedEmployee.employee_id,
          first_name: editEmpFirstName.trim(),
          last_name: editEmpLastName.trim(),
          email: editEmpEmail.trim(),
        },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpModalMsg({ text: "Employee profile updated successfully!", isError: false });
        setSelectedEmployee({
          ...selectedEmployee,
          first_name: editEmpFirstName.trim(),
          last_name: editEmpLastName.trim(),
          email: editEmpEmail.trim(),
        });
        setIsEditingEmployee(false);
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to update employee details",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };

  // Delete Employee Account
  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    setEmpModalLoading(true);
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/developer/delete-employee/${selectedEmployee.employee_id}`,
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
      if (res.data.success) {
        handleCloseEmployeeModal();
        fetchEmployees();

        // Refresh system state logs
        const stateRes = await axios.get(`${API_BASE_URL}/api/developer/system-state`, {
          headers: getDevHeaders(),
          withCredentials: true,
        });
        setLogs(stateRes.data.logs || []);
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to delete employee account",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };



  return {
    isAuthorized,
    setIsAuthorized,
    isCheckingAuth,
    setIsCheckingAuth,
    pin,
    setPin,
    error,
    setError,
    loading,
    setLoading,
    showPin,
    setShowPin,
    maintenanceMode,
    setMaintenanceMode,
    logs,
    setLogs,
    dbLoading,
    setDbLoading,
    toggleLoading,
    setToggleLoading,
    admins,
    setAdmins,
    adminFullName,
    setAdminFullName,
    adminEmail,
    setAdminEmail,
    adminPassword,
    setAdminPassword,
    showAdminPassword,
    setShowAdminPassword,
    adminLoading,
    setAdminLoading,
    adminSuccess,
    setAdminSuccess,
    adminError,
    setAdminError,
    selectedAdmin,
    setSelectedAdmin,
    copiedEmail,
    setCopiedEmail,
    resetPasswordVal,
    setResetPasswordVal,
    showResetPassword,
    setShowResetPassword,
    resetLoading,
    setResetLoading,
    resetMsg,
    setResetMsg,
    isEditingAdmin,
    setIsEditingAdmin,
    editFullName,
    setEditFullName,
    editEmail,
    setEditEmail,
    editLoading,
    setEditLoading,
    editMsg,
    setEditMsg,
    deleteLoading,
    setDeleteLoading,
    showDeleteConfirm,
    setShowDeleteConfirm,
    dbStats,
    setDbStats,
    dbStatsLoading,
    setDbStatsLoading,
    selectedTable,
    setSelectedTable,
    tableData,
    setTableData,
    tableDataLoading,
    setTableDataLoading,
    tableSearchQuery,
    setTableSearchQuery,
    currentPinInput,
    setCurrentPinInput,
    newPinInput,
    setNewPinInput,
    confirmNewPinInput,
    setConfirmNewPinInput,
    showPinFields,
    setShowPinFields,
    changePinLoading,
    setChangePinLoading,
    changePinMsg,
    setChangePinMsg,
    isChangePinOpen,
    setIsChangePinOpen,
    mapDiag,
    setMapDiag,
    mapDiagLoading,
    setMapDiagLoading,
    mapDiagFilter,
    setMapDiagFilter,
    showFlaggedLotsList,
    setShowFlaggedLotsList,
    accountTab,
    setAccountTab,
    employees,
    setEmployees,
    employeeSearchQuery,
    setEmployeeSearchQuery,
    empFirstName,
    setEmpFirstName,
    empLastName,
    setEmpLastName,
    empEmail,
    setEmpEmail,
    empPassword,
    setEmpPassword,
    showEmpPassword,
    setShowEmpPassword,
    empFormLoading,
    setEmpFormLoading,
    empFormError,
    setEmpFormError,
    empFormSuccess,
    setEmpFormSuccess,
    selectedEmployee,
    setSelectedEmployee,
    editEmpFirstName,
    setEditEmpFirstName,
    editEmpLastName,
    setEditEmpLastName,
    editEmpEmail,
    setEditEmpEmail,
    empNewPassword,
    setEmpNewPassword,
    showEmpNewPassword,
    setShowEmpNewPassword,
    empModalLoading,
    setEmpModalLoading,
    empModalMsg,
    setEmpModalMsg,
    showDeleteEmpConfirm,
    setShowDeleteEmpConfirm,
    isEditingEmployee,
    setIsEditingEmployee,
    activeSidebarTab,
    setActiveSidebarTab,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    rowToDelete,
    setRowToDelete,
    rowDeleteLoading,
    setRowDeleteLoading,
    showPurgeModal,
    setShowPurgeModal,
    purgeLoading,
    setPurgeLoading,
    purgeSuccessMsg,
    setPurgeSuccessMsg,
    showDemoDataModal,
    setShowDemoDataModal,
    demoDataCount,
    setDemoDataCount,
    demoDataLoading,
    setDemoDataLoading,
    demoDataSuccessMsg,
    setDemoDataSuccessMsg,
    demoModalTab,
    setDemoModalTab,
    demoEmployeesList,
    setDemoEmployeesList,
    demoEmpLoading,
    setDemoEmpLoading,
    demoEmpSuccessMsg,
    setDemoEmpSuccessMsg,
    copiedKey,
    setCopiedKey,
    showDemoPasswords,
    setShowDemoPasswords,
    apiHealthData,
    setApiHealthData,
    apiHealthLoading,
    setApiHealthLoading,
    apiDomainFilter,
    setApiDomainFilter,
    envHealthData,
    setEnvHealthData,
    envHealthLoading,
    setEnvHealthLoading,
    envCategoryFilter,
    setEnvCategoryFilter,
    showKillSwitchModal,
    setShowKillSwitchModal,
    killSwitchLoading,
    setKillSwitchLoading,
    killSwitchSuccessMsg,
    setKillSwitchSuccessMsg,
    lastKillSwitchTime,
    setLastKillSwitchTime,
    selectedLogCategory,
    setSelectedLogCategory,
    logModalSearch,
    setLogModalSearch,
    showClearCategoryConfirm,
    setShowClearCategoryConfirm,
    clearCategoryLoading,
    setClearCategoryLoading,
    messengerTestLoading,
    setMessengerTestLoading,
    messengerTestMsg,
    setMessengerTestMsg,
    messengerRecipients,
    setMessengerRecipients,
    fetchRecipientsLoading,
    setFetchRecipientsLoading,
    getDevHeaders,
    dismissedCount,
    setDismissedCount,
    alertFilters,
    setAlertFilters,
    messengerMasterEnabled,
    setMessengerMasterEnabled,
    fetchAlertFilters,
    handleToggleMessengerMaster,
    handleToggleFilter,
    handleDismissRecipient,
    handleRestoreRecipients,
    fetchMessengerRecipients,
    handleToggleRecipient,
    handleClearCategoryLogs,
    fetchSystemState,
    handleTriggerKillSwitch,
    fetchApiHealth,
    fetchEnvHealth,
    fetchAdmins,
    fetchEmployees,
    fetchDbStats,
    fetchMapDiagnostics,
    handleVerifyPin,
    handleCreateAdmin,
    handleResetAdminPassword,
    handleStartEdit,
    handleSaveEditAdmin,
    handleDeleteAdmin,
    handleBackupDownload,
    handleToggleMaintenance,
    handleOpenTableData,
    handleDownloadTableJson,
    handleDeleteRowConfirm,
    handlePurgeTestDataConfirm,
    handleGenerateDemoDataConfirm,
    fetchDemoStaffStatus,
    handleToggleDemoEmployee,
    handleGenerateDemoEmployees,
    handleDeactivateAllDemoEmployees,
    handleCopyText,
    handleChangePinSubmit,
    handleCreateEmployee,
    handleOpenEmployeeModal,
    handleCloseEmployeeModal,
    handleGenerateRandomEmpPassword,
    handleResetEmployeePassword,
    handleUpdateEmployee,
    handleDeleteEmployee,
  };
};

export default useDeveloperPanel;
