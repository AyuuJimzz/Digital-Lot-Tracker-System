import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";

const DeveloperPanel = () => {
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
  const [empPhone, setEmpPhone] = useState("");
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
  const [editEmpPhone, setEditEmpPhone] = useState("");
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

  const handleSimulateBotCommand = async (commandName) => {
    setMessengerTestLoading(true);
    setMessengerTestMsg({ text: "", isError: false });
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/messenger/simulate-command`,
        { command: commandName },
        { headers: getDevHeaders(), withCredentials: true }
      );
      if (res.data?.success) {
        setMessengerTestMsg({
          text: `🤖 Simulated chat '${commandName}' executed! Check your Messenger inbox for the bot reply.`,
          isError: false,
        });
        fetchSystemState();
      }
    } catch (err) {
      setMessengerTestMsg({
        text: `❌ Command execution failed: ${err.response?.data?.error || err.message}`,
        isError: true,
      });
    } finally {
      setMessengerTestLoading(false);
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
      alert(err.response?.data?.error || "Failed to delete admin account");
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
      alert("Failed to download database backup: " + (err.message || "Server Error"));
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
      alert("Failed to toggle maintenance mode: " + (err.response?.data?.error || "Error"));
    } finally {
      setToggleLoading(false);
    }
  };

  // Helper for Database Table icons and style themes
  const getTableIcon = (tableName) => {
    const t = (tableName || "").toLowerCase();
    if (t.includes("propert")) return { icon: "🏡", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" };
    if (t.includes("lot")) return { icon: "📍", color: "bg-teal-500/10 text-teal-400 border-teal-500/25" };
    if (t.includes("customer") || t.includes("user")) return { icon: "👥", color: "bg-blue-500/10 text-blue-400 border-blue-500/25" };
    if (t.includes("transaction") || t.includes("payment")) return { icon: "💳", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" };
    if (t.includes("receipt")) return { icon: "🧾", color: "bg-amber-500/10 text-amber-400 border-amber-500/25" };
    if (t.includes("employee") || t.includes("staff")) return { icon: "👔", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" };
    if (t.includes("admin")) return { icon: "🛡️", color: "bg-purple-500/10 text-purple-400 border-purple-500/25" };
    if (t.includes("inquir") || t.includes("message")) return { icon: "💬", color: "bg-sky-500/10 text-sky-400 border-sky-500/25" };
    return { icon: "🗄️", color: "bg-slate-800 text-slate-300 border-slate-700" };
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
      alert(err.response?.data?.error || "Failed to delete record");
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
      alert(err.response?.data?.error || "Failed to purge test data");
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
      alert(err.response?.data?.error || "Failed to generate demo data");
    } finally {
      setDemoDataLoading(false);
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
          phone_number: empPhone.trim() || null,
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
        setEmpPhone("");
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
    setEditEmpPhone(emp.phone_number || "");
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
          phone_number: editEmpPhone.trim() || null,
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
          phone_number: editEmpPhone.trim() || null,
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

  // Helper to format table explorer cell values cleanly with rich pills, dates, and badges
  const renderTableExplorerCell = (col, val) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-slate-600 font-mono text-xs select-none pl-1">—</span>;
    }

    const colName = (col.name || "").toLowerCase();
    const valStr = String(val);

    // Booleans
    if (typeof val === "boolean" || (col.type === "tinyint" && (val === 0 || val === 1) && (colName.includes("is_") || colName.includes("has_") || colName.includes("required")))) {
      const isTrue = val === true || val === 1;
      return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono border ${
          isTrue ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-800 text-slate-400 border-slate-700"
        }`}>
          {isTrue ? "TRUE" : "FALSE"}
        </span>
      );
    }

    // Passwords (already masked from backend)
    if (colName.includes("password")) {
      return (
        <span className="font-mono text-xs text-amber-400/90 font-medium tracking-wider">
          •••••••• <span className="text-[9px] text-slate-500 font-normal">[Bcrypt]</span>
        </span>
      );
    }

    // Status, Roles & Payment Types
    if (colName.includes("status") || colName.includes("payment_type") || colName.includes("role") || colName.includes("gender")) {
      let badgeStyle = "bg-slate-900 text-slate-300 border-slate-800";
      const lower = valStr.toLowerCase();
      if (lower === "available" || lower === "cash" || lower === "admin" || lower === "active" || lower === "paid") {
        badgeStyle = "bg-slate-900 text-emerald-300 border-emerald-500/30";
      } else if (lower === "reserved" || lower === "installment" || lower === "employee") {
        badgeStyle = "bg-slate-900 text-sky-300 border-sky-500/30";
      } else if (lower === "sold" || lower === "no downpayment" || lower === "pending") {
        badgeStyle = "bg-slate-900 text-amber-300 border-amber-500/30";
      } else if (lower === "cancelled" || lower === "inactive" || lower === "failed") {
        badgeStyle = "bg-slate-900 text-rose-300 border-rose-500/30";
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border capitalize font-sans ${badgeStyle}`}>
          {valStr}
        </span>
      );
    }

    // Primary Keys & Foreign Keys (#ID badges)
    if (col.isPrimary || colName.endsWith("_id") || colName === "id") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800/80 text-slate-300 font-mono text-[11px]">
          #{valStr}
        </span>
      );
    }

    // Price, Amount & Currency
    if (colName.includes("price") || colName.includes("amount") || colName.includes("balance") || colName.includes("payment") || colName.includes("cost")) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (
          <span className="font-mono text-slate-200 font-medium text-xs">
            ₱{num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }

    // Area (sqm)
    if (colName.includes("area") || colName.includes("sqm")) {
      return (
        <span className="font-mono text-slate-200 font-medium text-xs">
          {valStr} <span className="text-[10px] text-slate-500">sqm</span>
        </span>
      );
    }

    // Email
    if (colName.includes("email")) {
      return (
        <span className="text-slate-300 font-mono text-xs" title={valStr}>
          {valStr}
        </span>
      );
    }

    // Dates & Timestamps
    if (colName.includes("date") || colName.includes("time") || colName.includes("created_at") || colName.includes("updated_at") || colName.includes("dob")) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const dateFormatted = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const timeFormatted = d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          return (
            <span className="text-slate-300 text-xs whitespace-nowrap" title={valStr}>
              <span className="text-slate-200">{dateFormatted}</span>
              <span className="text-slate-500 text-[10px] ml-1.5 font-mono">· {timeFormatted}</span>
            </span>
          );
        }
      } catch (e) {}
    }

    // Coordinates GeoJSON
    if (colName.includes("coordinate") || colName.includes("geometry") || colName.includes("polygon")) {
      return (
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded" title={valStr}>
          🗺️ GeoJSON
        </span>
      );
    }

    // Default Text
    return (
      <span className="text-slate-300 text-xs font-sans max-w-sm truncate block" title={valStr}>
        {valStr}
      </span>
    );
  };

  // ──────── INITIAL AUTH CHECK LOADING SCREEN ────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-mono">Authenticating Developer Session...</p>
        </div>
      </div>
    );
  }

  // ──────── PIN VERIFICATION SCREEN ────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-white relative font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm mx-4 bg-[#111827]/60 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-[#10b981]/15 text-[#10b981] rounded-2xl border border-[#10b981]/25 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Developer Console</h1>
            <p className="text-gray-400 text-xs mt-1">Enter your security PIN to access system controls</p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full tracking-[1.5em] text-center text-xl font-bold py-3.5 bg-[#030712]/50 border border-white/10 rounded-xl focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition flex items-center justify-center"
              >
                {showPin ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && <div className="text-red-400 text-xs text-center font-medium">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/20 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Access Console"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ──────── MAIN DEVELOPER PANEL ────────
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col lg:flex-row relative selection:bg-[#10b981]/30 selection:text-[#10b981]">
      {/* Background Ambient Glows Container */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#10b981]/5 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 right-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[180px]" />
      </div>

      {/* ── LEFT FIXED SIDEBAR NAVIGATION ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-950/95 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10 text-emerald-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Developer Console</h1>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ROOT LIVE SESSION
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="p-3.5 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Console Modules
          </div>

          {/* 1. System Controls & Logs */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("SYSTEM");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "SYSTEM"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "SYSTEM" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">System & Logs</div>
                <div className="text-[10px] text-slate-500">Maintenance, PIN & Activity</div>
              </div>
            </div>
          </button>

          {/* 2. Database & Storage */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("DATABASE");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "DATABASE"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "DATABASE" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">Database & Storage</div>
                <div className="text-[10px] text-slate-500">Aiven Cloud MySQL</div>
              </div>
            </div>
          </button>

          {/* 3. Map Diagnostics */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("MAP");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "MAP"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "MAP" ? "bg-teal-500/20 text-teal-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">Map & Geometry</div>
                <div className="text-[10px] text-slate-500">Polygon & Coordinates</div>
              </div>
            </div>
          </button>

          {/* 4. Accounts & Credentials */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ACCOUNTS");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ACCOUNTS"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ACCOUNTS" ? "bg-purple-500/20 text-purple-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">Accounts Directory</div>
                <div className="text-[10px] text-slate-500">Admins & Employees</div>
              </div>
            </div>
          </button>

          {/* 5. API Routes & Endpoint Health */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ENDPOINTS");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ENDPOINTS"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ENDPOINTS" ? "bg-sky-500/20 text-sky-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">API Routes & Health</div>
                <div className="text-[10px] text-slate-500">Endpoints & Latency</div>
              </div>
            </div>
          </button>

          {/* 6. Environment (.env) Health Inspector */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ENV");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ENV"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ENV" ? "bg-amber-500/20 text-amber-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">Environment (.env)</div>
                <div className="text-[10px] text-slate-500">Config & Security Keys</div>
              </div>
            </div>
          </button>

          {/* 7. Facebook Messenger Alert Bot */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("MESSENGER");
              setMobileSidebarOpen(false);
              fetchAlertFilters();
              if (messengerRecipients.length === 0) {
                fetchMessengerRecipients();
              }
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "MESSENGER"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "MESSENGER" ? "bg-sky-500/20 text-sky-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold">Messenger Alert Bot</div>
                <div className="text-[10px] text-slate-500">Push Notifications</div>
              </div>
            </div>
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-2.5 bg-slate-950/80">
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Maintenance State</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              maintenanceMode
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {maintenanceMode ? "ACTIVE" : "DISABLED"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => (window.location.href = "/admin-panel")}
              className="py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              App
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem("devPin");
                setIsAuthorized(false);
                setPin("");
                window.location.reload();
              }}
              className="py-2 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/20 transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* ── RIGHT MAIN WORKSPACE ── */}
      <main className="flex-1 lg:pl-72 flex flex-col min-w-0 z-10 min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span>Developer Console</span>
                <span className="text-slate-600">/</span>
                <span className="text-white font-bold">
                  {activeSidebarTab === "SYSTEM" && "System Controls & Logs"}
                  {activeSidebarTab === "DATABASE" && "Database & Storage"}
                  {activeSidebarTab === "MAP" && "Map & Lot Diagnostics"}
                  {activeSidebarTab === "ACCOUNTS" && "Accounts & Credentials"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Ping / Refresh */}
            {dbStats && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ⚡ {dbStats.latencyMs}ms Aiven
              </span>
            )}

            <button
              onClick={() => {
                fetchDbStats();
                fetchMapDiagnostics();
                fetchAdmins();
                fetchEmployees();
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Refresh console metrics"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Dynamic View Body Container */}
        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8">
          {/* ── MODULE 1: SYSTEM CONTROLS & LOGS ── */}
          {activeSidebarTab === "SYSTEM" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div id="zone-controls-logs" className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-6">
                {/* System Control Cards (Left Column - 5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Card A: Database Backup */}
                  <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                            💾
                          </div>
                          <h2 className="text-sm font-bold text-white">Database Backup & Export</h2>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                          .sql
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Extract complete table schemas and row data into an importable .sql dump file.
                      </p>
                    </div>

                    <button
                      onClick={handleBackupDownload}
                      disabled={dbLoading}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {dbLoading ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Extracting Database...</span>
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                          <span>Download Database (.sql)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card B: Maintenance Mode Gate */}
                  <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                            🔒
                          </div>
                          <h2 className="text-sm font-bold text-white">Maintenance Mode Gate</h2>
                        </div>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                          maintenanceMode
                            ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          {maintenanceMode ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        When enabled, public web routes intercept traffic with a 503 Maintenance screen.
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-xs font-medium text-slate-300">Toggle Maintenance State</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={maintenanceMode}
                          onChange={handleToggleMaintenance}
                          disabled={toggleLoading}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                    </div>
                  </div>

                  {/* Card C: Developer Security PIN Tool */}
                  <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                          🔑
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-white">Developer Security PIN</h2>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsChangePinOpen(!isChangePinOpen);
                          setChangePinMsg({ text: "", isError: false });
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                      >
                        {isChangePinOpen ? "Cancel" : "Change PIN"}
                      </button>
                    </div>

                    {!isChangePinOpen ? (
                      <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs text-slate-400 mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-sm">••••</span>
                          <span>Active Developer Passkey</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          PROTECTED
                        </span>
                      </div>
                    ) : (
                      <form onSubmit={handleChangePinSubmit} className="space-y-3 pt-2 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Current PIN
                          </label>
                          <input
                            type={showPinFields ? "text" : "password"}
                            value={currentPinInput}
                            onChange={(e) => setCurrentPinInput(e.target.value)}
                            placeholder="Enter current PIN"
                            autoComplete="off"
                            className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              New PIN
                            </label>
                            <input
                              type={showPinFields ? "text" : "password"}
                              value={newPinInput}
                              onChange={(e) => setNewPinInput(e.target.value)}
                              placeholder="Min 4 digits"
                              autoComplete="new-password"
                              className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Confirm PIN
                            </label>
                            <input
                              type={showPinFields ? "text" : "password"}
                              value={confirmNewPinInput}
                              onChange={(e) => setConfirmNewPinInput(e.target.value)}
                              placeholder="Re-type PIN"
                              autoComplete="new-password"
                              className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setShowPinFields(!showPinFields)}
                            className="text-[10px] text-slate-400 hover:text-white transition"
                          >
                            {showPinFields ? "Hide digits" : "Show digits"}
                          </button>
                        </div>

                        {changePinMsg.text && (
                          <div className={`text-xs font-medium p-2.5 rounded-xl border ${changePinMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                            {changePinMsg.text}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={changePinLoading || !currentPinInput.trim() || !newPinInput.trim() || !confirmNewPinInput.trim()}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          {changePinLoading ? "Updating PIN..." : "Save PIN"}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Card D: Emergency Global Kill Switch / Force Logout All */}
                  <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center text-sm">
                            ⚠️
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-white">Emergency Kill Switch</h2>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          SESSIONS
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Invalidates all active login sessions and JWT tokens for Admin and Employee accounts.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowKillSwitchModal(true)}
                      className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                      </svg>
                      <span>Terminate All Active Sessions</span>
                    </button>
                  </div>
                </div>

          {/* ── SEPARATED ACTIVITY LOGS DIRECTORY (4 INTERACTIVE CARDS) ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Section Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📋</span> System Activity & Security Logs Directory
                </h3>
                <p className="text-xs text-slate-400">
                  Select a category card below to inspect full logs, search entries, or clear audit records.
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-slate-900 text-slate-300 border border-slate-800 rounded-xl">
                {logs.length} Total Logs
              </span>
            </div>

            {/* 4 Categorized Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Card 1: User & Staff Access Logs */}
              {(() => {
                const authLogs = logs.filter(l => (l.type || "").toUpperCase() === "AUTH");
                const loginsCount = authLogs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return ev.toLowerCase().includes("logged in") || ev.toLowerCase().includes("authenticated");
                }).length;
                const logoutsCount = authLogs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return ev.toLowerCase().includes("logged out") || ev.toLowerCase().includes("force logout");
                }).length;
                const latestAuth = authLogs[0];

                return (
                  <div
                    onClick={() => {
                      setSelectedLogCategory("AUTH");
                      setLogModalSearch("");
                      setShowClearCategoryConfirm(false);
                    }}
                    className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                          👥
                        </div>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {authLogs.length} {authLogs.length === 1 ? "Log" : "Logs"}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                        User & Staff Access Logs
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Admin, Employee, and Developer authentications, logins & logouts.
                      </p>

                      {/* Clean Breakdown */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {loginsCount} Logins
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {logoutsCount} Logouts
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                      <span className="text-[11px] text-slate-500 font-normal">
                        {latestAuth ? `Latest: ${new Date(latestAuth.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No logs yet"}
                      </span>
                      <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                    </div>
                  </div>
                );
              })()}

              {/* Card 2: Security & Error Alerts */}
              {(() => {
                const secLogs = logs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  const type = (l.type || "").toUpperCase();
                  return type === "SECURITY" || type === "ERROR" || type === "CRASH" || ev.includes("KILL SWITCH") || ev.includes("System Error");
                });
                const errorsCount = secLogs.filter(l => {
                  const type = (l.type || "").toUpperCase();
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return type === "ERROR" || type === "CRASH" || ev.includes("System Error") || ev.includes("Exception");
                }).length;
                const secOpsCount = secLogs.length - errorsCount;
                const latestSec = secLogs[0];

                return (
                  <div
                    onClick={() => {
                      setSelectedLogCategory("SECURITY");
                      setLogModalSearch("");
                      setShowClearCategoryConfirm(false);
                    }}
                    className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                          🚨
                        </div>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {secLogs.length} {secLogs.length === 1 ? "Alert" : "Alerts"}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                        Security & System Error Alerts
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        API runtime errors, unhandled exceptions, kill switches & token revocations.
                      </p>

                      {/* Clean Breakdown */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {errorsCount} Errors
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {secOpsCount} Security Actions
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                      <span className="text-[11px] text-slate-500 font-normal">
                        {latestSec ? `Latest: ${new Date(latestSec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No alerts"}
                      </span>
                      <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Database & Capstone Demo Records */}
              {(() => {
                const dbLogs = logs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return (l.type || "").toUpperCase() === "DATABASE" || (l.type || "").toUpperCase() === "BACKUP" || ev.includes("demo") || ev.includes("Capstone") || ev.includes("Purge");
                });
                const seedCount = dbLogs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return ev.includes("demo") || ev.includes("Capstone");
                }).length;
                const purgeCount = dbLogs.filter(l => {
                  const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                  return ev.includes("Purged") || ev.includes("purge");
                }).length;
                const latestDb = dbLogs[0];

                return (
                  <div
                    onClick={() => {
                      setSelectedLogCategory("DATABASE");
                      setLogModalSearch("");
                      setShowClearCategoryConfirm(false);
                    }}
                    className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                          💾
                        </div>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {dbLogs.length} {dbLogs.length === 1 ? "Record" : "Records"}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                        Database & Demo Records
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Capstone demo seed data generation, test data purges, and .sql backups.
                      </p>

                      {/* Clean Breakdown */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {seedCount} Seeds
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {purgeCount} Purges
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                      <span className="text-[11px] text-slate-500 font-normal">
                        {latestDb ? `Latest: ${new Date(latestDb.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No records yet"}
                      </span>
                      <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                    </div>
                  </div>
                );
              })()}

              {/* Card 4: System, Emails & Maintenance Gates */}
              {(() => {
                const sysLogs = logs.filter(l => ["MAINTENANCE", "SYSTEM", "ADMIN", "EMAIL"].includes((l.type || "").toUpperCase()));
                const emailCount = sysLogs.filter(l => (l.type || "").toUpperCase() === "EMAIL").length;
                const sysOpsCount = sysLogs.length - emailCount;
                const latestSys = sysLogs[0];

                return (
                  <div
                    onClick={() => {
                      setSelectedLogCategory("SYSTEM");
                      setLogModalSearch("");
                      setShowClearCategoryConfirm(false);
                    }}
                    className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                          🛠️
                        </div>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {sysLogs.length} {sysLogs.length === 1 ? "Event" : "Events"}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                        System, Emails & Maintenance
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Outgoing client emails, 503 maintenance mode, PIN updates & server events.
                      </p>

                      {/* Clean Breakdown */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {emailCount} Emails
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                          {sysOpsCount} Operations
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                      <span className="text-[11px] text-slate-500 font-normal">
                        {latestSys ? `Latest: ${new Date(latestSys.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No events yet"}
                      </span>
                      <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      </div>
    )}

          {/* ── MODULE 5: API ROUTES & ENDPOINT HEALTH MONITOR ── */}
          {activeSidebarTab === "ENDPOINTS" && (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      API Routes & Endpoint Health Monitor
                    </h2>
                    <p className="text-xs text-slate-400">
                      Live availability, HTTP status verification, and response latency monitoring across core platform routes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Status Badge */}
                  {apiHealthData && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      🟢 {apiHealthData.healthyCount}/{apiHealthData.totalEndpoints} Operational
                    </span>
                  )}

                  {/* Rescan Button */}
                  <button
                    onClick={fetchApiHealth}
                    disabled={apiHealthLoading}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className={apiHealthLoading ? "animate-spin text-sky-400" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    {apiHealthLoading ? "Testing Endpoints..." : "Scan Endpoints"}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 4 Hero KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      System Availability
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {apiHealthData ? `${Math.round((apiHealthData.healthyCount / apiHealthData.totalEndpoints) * 100)}%` : "100%"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {apiHealthData ? `${apiHealthData.healthyCount} of ${apiHealthData.totalEndpoints} routes active` : "All routes responsive"}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Average Latency
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {apiHealthData ? `${apiHealthData.avgLatencyMs} ms` : "—"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Optimal response time
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Monitored Routes
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {apiHealthData ? `${apiHealthData.totalEndpoints} Endpoints` : "9 Endpoints"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Public, Admin, & DB APIs
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Last Checked
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {apiHealthData ? new Date(apiHealthData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Auto-verified live
                    </div>
                  </div>
                </div>

                {/* Domain Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["ALL", "Public / Map", "Transactions", "Analytics", "Developer Core", "Infrastructure"].map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => setApiDomainFilter(dom)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        apiDomainFilter === dom
                          ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                          : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
                      }`}
                    >
                      {dom}
                    </button>
                  ))}
                </div>

                {/* Endpoints Table Matrix */}
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-3 px-4 font-semibold w-16 text-center">Method</th>
                          <th className="py-3 px-4 font-semibold min-w-[180px]">Endpoint Path</th>
                          <th className="py-3 px-4 font-semibold min-w-[200px]">Name & Purpose</th>
                          <th className="py-3 px-4 font-semibold min-w-[110px]">Domain</th>
                          <th className="py-3 px-4 font-semibold text-center min-w-[80px]">Status</th>
                          <th className="py-3 px-4 font-semibold text-center min-w-[90px]">Latency</th>
                          <th className="py-3 px-4 font-semibold text-right min-w-[80px]">Health</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {apiHealthLoading && !apiHealthData ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                              Scanning and verifying platform endpoints...
                            </td>
                          </tr>
                        ) : !apiHealthData || !apiHealthData.endpoints || apiHealthData.endpoints.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-slate-500 italic text-xs">
                              Click "Scan Endpoints" to test backend routes.
                            </td>
                          </tr>
                        ) : (
                          apiHealthData.endpoints
                            .filter((ep) => apiDomainFilter === "ALL" || ep.domain === apiDomainFilter)
                            .map((ep, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-slate-900/40 transition-colors"
                              >
                                {/* Method */}
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                    ep.method === "GET"
                                      ? "bg-slate-800 text-emerald-300 border border-slate-700"
                                      : ep.method === "POST"
                                      ? "bg-slate-800 text-sky-300 border border-slate-700"
                                      : "bg-slate-800 text-purple-300 border border-slate-700"
                                  }`}>
                                    {ep.method}
                                  </span>
                                </td>

                                {/* Path */}
                                <td className="py-3 px-4 font-mono text-slate-200">
                                  {ep.path}
                                </td>

                                {/* Name & Purpose */}
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-200">{ep.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{ep.description}</div>
                                </td>

                                {/* Domain */}
                                <td className="py-3 px-4 text-slate-400 text-[11px]">
                                  {ep.domain}
                                </td>

                                {/* HTTP Status */}
                                <td className="py-3 px-4 text-center">
                                  <span className="text-[11px] font-mono text-slate-300">
                                    {ep.status}
                                  </span>
                                </td>

                                {/* Latency */}
                                <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                                  {ep.latencyMs} ms
                                </td>

                                {/* Health */}
                                <td className="py-3 px-4 text-right">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                                    <span className={`w-1.5 h-1.5 rounded-full ${ep.isHealthy ? "bg-emerald-400" : "bg-rose-500"}`} />
                                    <span>{ep.isHealthy ? "Healthy" : "Failed"}</span>
                                  </span>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MODULE 6: ENVIRONMENT VARIABLES (.ENV) HEALTH INSPECTOR ── */}
          {activeSidebarTab === "ENV" && (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      Environment Variables (.env) Health Inspector
                    </h2>
                    <p className="text-xs text-slate-400">
                      Audit backend deployment environment variables, verify required keys, and safely inspect masked configurations
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Status Badge */}
                  {envHealthData && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                      envHealthData.allRequiredSet
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${envHealthData.allRequiredSet ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                      {envHealthData.allRequiredSet ? "🟢 All Required Configs Set" : "⚠️ Missing Required Variables"}
                    </span>
                  )}

                  {/* Rescan Button */}
                  <button
                    onClick={fetchEnvHealth}
                    disabled={envHealthLoading}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className={envHealthLoading ? "animate-spin text-amber-400" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    {envHealthLoading ? "Auditing..." : "Re-check .env"}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 4 Hero KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Required Variables
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {envHealthData ? `${envHealthData.configuredRequired} / ${envHealthData.totalRequired}` : "5 / 5"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Core keys satisfied</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Total Configured
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {envHealthData ? `${envHealthData.configuredCount} / ${envHealthData.totalCount}` : "12 / 13"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">System & optional configs</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Secret Masking
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      Active
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Zero plain text exposure</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Target Cloud
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      Render & Aiven
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Production Ready</div>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["ALL", "Database", "Security", "Server", "Notifications"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEnvCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        envCategoryFilter === cat
                          ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                          : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Environment Variables Table */}
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-3 px-4 font-semibold min-w-[200px]">Variable</th>
                          <th className="py-3 px-4 font-semibold min-w-[220px]">Description</th>
                          <th className="py-3 px-4 font-semibold min-w-[120px] text-center">Status</th>
                          <th className="py-3 px-4 font-semibold min-w-[180px] text-right font-mono">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {envHealthLoading && !envHealthData ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-slate-500 font-mono text-xs">
                              Auditing backend environment variables...
                            </td>
                          </tr>
                        ) : !envHealthData || !envHealthData.variables || envHealthData.variables.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-slate-500 italic text-xs">
                              Click "Re-check .env" to inspect environment keys.
                            </td>
                          </tr>
                        ) : (
                          envHealthData.variables
                            .filter((v) => envCategoryFilter === "ALL" || v.category === envCategoryFilter)
                            .map((v, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-slate-900/40 transition-colors"
                              >
                                {/* Key & Required Badge */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-200">{v.key}</span>
                                    {v.required && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                                        req
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Description */}
                                <td className="py-3 px-4 text-slate-400 text-[11px]">
                                  {v.description}
                                </td>

                                {/* Status Dot */}
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      v.status === "CONFIGURED"
                                        ? "bg-emerald-400"
                                        : v.status === "USING_DEFAULT"
                                        ? "bg-sky-400"
                                        : v.status === "MISSING_REQUIRED"
                                        ? "bg-rose-500"
                                        : "bg-slate-600"
                                    }`} />
                                    <span>
                                      {v.status === "CONFIGURED"
                                        ? "Set"
                                        : v.status === "USING_DEFAULT"
                                        ? "Default"
                                        : v.status === "MISSING_REQUIRED"
                                        ? "Missing"
                                        : "Unset"}
                                    </span>
                                  </span>
                                </td>

                                {/* Masked Value */}
                                <td className="py-3 px-4 text-right font-mono text-[11px]">
                                  {v.displayValue ? (
                                    <span className="text-slate-300">
                                      {v.displayValue}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 italic">Unset</span>
                                  )}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MODULE 7: FACEBOOK MESSENGER REAL-TIME ALERT SYSTEM ── */}
          {activeSidebarTab === "MESSENGER" && (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center text-lg shrink-0">
                    💬
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Facebook Messenger Bot & Alerts</h2>
                    <p className="text-[11px] text-slate-400">Manage broadcast recipients, notification categories, and bot commands.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Master Switch */}
                  <button
                    type="button"
                    onClick={handleToggleMessengerMaster}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${
                      messengerMasterEnabled
                        ? "bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700"
                        : "bg-rose-950/30 text-rose-300 border-rose-500/30 hover:bg-rose-950/50"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${messengerMasterEnabled ? "bg-emerald-400" : "bg-rose-500"}`} />
                    <span>{messengerMasterEnabled ? "Alerts: Enabled" : "Alerts: Paused"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={fetchMessengerRecipients}
                    disabled={fetchRecipientsLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={fetchRecipientsLoading ? "animate-spin" : ""}>
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{fetchRecipientsLoading ? "Scanning..." : "Scan Contacts"}</span>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Master Paused Banner */}
                {!messengerMasterEnabled && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
                    <div className="flex items-center gap-2.5">
                      <span>⏸️</span>
                      <span>Messenger notifications are currently paused. No alerts will be sent to Facebook.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleMessengerMaster}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition"
                    >
                      Resume
                    </button>
                  </div>
                )}

                {/* 1. Category Notification Filters (Clean 4-column Grid) */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <span>🔔</span>
                    <span>Notification Filters</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Crash Errors */}
                    <div
                      onClick={() => handleToggleFilter("criticalErrors")}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                        alertFilters.criticalErrors
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">🚨</span>
                        <div>
                          <div className="text-xs font-bold">500 & Crash Errors</div>
                          <div className="text-[10px] text-slate-400">Database & server exceptions</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        alertFilters.criticalErrors ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                      }`}>
                        {alertFilters.criticalErrors ? "ON" : "OFF"}
                      </span>
                    </div>

                    {/* Lot Reservations */}
                    <div
                      onClick={() => handleToggleFilter("reservations")}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                        alertFilters.reservations
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">📝</span>
                        <div>
                          <div className="text-xs font-bold">Lot Reservations</div>
                          <div className="text-[10px] text-slate-400">Client & staff booking events</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        alertFilters.reservations ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                      }`}>
                        {alertFilters.reservations ? "ON" : "OFF"}
                      </span>
                    </div>

                    {/* Security Logins */}
                    <div
                      onClick={() => handleToggleFilter("authSecurity")}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                        alertFilters.authSecurity
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">🛡️</span>
                        <div>
                          <div className="text-xs font-bold">Security Logins</div>
                          <div className="text-[10px] text-slate-400">Admin & staff portal sign-ins</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        alertFilters.authSecurity ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                      }`}>
                        {alertFilters.authSecurity ? "ON" : "OFF"}
                      </span>
                    </div>

                    {/* System Config */}
                    <div
                      onClick={() => handleToggleFilter("systemChanges")}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                        alertFilters.systemChanges
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">⚙️</span>
                        <div>
                          <div className="text-xs font-bold">System Toggles</div>
                          <div className="text-[10px] text-slate-400">Maintenance mode & PIN updates</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        alertFilters.systemChanges ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                      }`}>
                        {alertFilters.systemChanges ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Broadcast Recipients List */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <span>👥</span>
                      <span>Broadcast Recipients ({messengerRecipients.filter((r) => r.isCurrent).length} Active)</span>
                    </div>
                    {dismissedCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreRecipients}
                        disabled={messengerTestLoading}
                        className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                      >
                        <span>🔄</span>
                        <span>Restore ({dismissedCount}) Hidden</span>
                      </button>
                    )}
                  </div>

                  {messengerRecipients.length === 0 ? (
                    <div className="p-4 bg-slate-900/50 rounded-lg text-center text-xs text-slate-400">
                      {fetchRecipientsLoading ? "Scanning Facebook Page chats..." : "No contacts found. Send a message to your Page first!"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {messengerRecipients.map((rec) => (
                        <div
                          key={rec.id}
                          className={`p-3 rounded-lg border transition flex items-center justify-between gap-2 ${
                            rec.isCurrent
                              ? "bg-slate-900/90 border-slate-700 text-white"
                              : "bg-slate-950 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              rec.isCurrent ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                            }`}>
                              {rec.name?.charAt(0) || "U"}
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-bold truncate">{rec.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">PSID: {rec.id}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleRecipient(rec)}
                              disabled={messengerTestLoading}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                rec.isCurrent
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-300"
                                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                              }`}
                            >
                              {rec.isCurrent ? "Active" : "Add"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDismissRecipient(rec)}
                              disabled={messengerTestLoading}
                              className="p-1 text-slate-500 hover:text-rose-400 transition"
                              title="Hide contact"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Available Messenger Bot Commands Directory */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <span>💬</span>
                      <span>Available Messenger Bot Commands</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Chat directly to Facebook Page</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {/* Command 1: #ID */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">#ID</span>
                        <span className="text-[9px] font-mono text-slate-500">or UID / PSID</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Returns your unique Facebook Page-Scoped User ID for alert registration.
                      </p>
                    </div>

                    {/* Command 2: STATUS */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">STATUS</span>
                        <span className="text-[9px] font-mono text-slate-500">or PING</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Replies with live server uptime, Aiven database latency, and platform status.
                      </p>
                    </div>

                    {/* Command 3: LOGS */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">LOGS</span>
                        <span className="text-[9px] font-mono text-slate-500">or ERRORS</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Dispatches the 3 most recent system events, logins, and error audit logs.
                      </p>
                    </div>

                    {/* Command 4: MAINT ON */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">MAINT ON</span>
                        <span className="text-[9px] font-mono text-slate-500">or MAINTENANCE ON</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Remotely activates 503 Maintenance Mode across public web routes.
                      </p>
                    </div>

                    {/* Command 5: MAINT OFF */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">MAINT OFF</span>
                        <span className="text-[9px] font-mono text-slate-500">or MAINTENANCE OFF</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Deactivates Maintenance Mode and restores full public website access.
                      </p>
                    </div>

                    {/* Command 6: HELP */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-200">HELP</span>
                        <span className="text-[9px] font-mono text-slate-500">or MENU</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Sends the complete directory of interactive bot commands.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-4">
                    <span>Webhook: <span className="text-slate-400">/api/messenger/webhook</span></span>
                    <span>Verify Token: <span className="text-slate-400">golden_dragon_bot_2026</span></span>
                  </div>
                </div>

                {messengerTestMsg.text && (
                  <div className={`p-3 rounded-xl border text-xs ${
                    messengerTestMsg.isError
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                      : "bg-slate-900 border-slate-700 text-slate-200"
                  }`}>
                    {messengerTestMsg.text}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MODULE 2: LIVE DATABASE TABLE & STORAGE INSPECTOR ── */}
          {activeSidebarTab === "DATABASE" && (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center text-lg shrink-0">
                    🗄️
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Database Tables & Storage Inspector</h2>
                    <p className="text-[11px] text-slate-400">Live breakdown of tables, record counts, storage footprint, and cloud response latency.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Latency badge */}
                  {dbStats && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {dbStats.latencyMs}ms ({dbStats.status})
                    </span>
                  )}

                  {/* Ping & Refresh Button */}
                  <button
                    onClick={fetchDbStats}
                    disabled={dbStatsLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className={dbStatsLoading ? "animate-spin text-sky-400" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{dbStatsLoading ? "Pinging..." : "Refresh"}</span>
                  </button>

                  {/* Seed Demo Data Button */}
                  <button
                    onClick={() => {
                      setDemoDataSuccessMsg("");
                      setShowDemoDataModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                    title="Generate realistic demo buyers and transactions for presentations"
                  >
                    <span>🎲</span>
                    <span>Demo Data</span>
                  </button>

                  {/* Purge Test Data Button */}
                  <button
                    onClick={() => setShowPurgeModal(true)}
                    className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 text-xs rounded-xl border border-rose-500/30 transition flex items-center gap-1.5"
                    title="Purge test inquiries, customers, and transactions"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Purge Data</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Metric 1: Ping / Latency */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Cloud Latency
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {dbStats ? `${dbStats.latencyMs} ms` : "--"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {dbStats ? `Status: ${dbStats.status}` : "Direct Query Ping"}
                    </div>
                  </div>

                  {/* Metric 2: Database Storage Size */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Database Storage
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {dbStats?.totalSizeFormatted || "0 KB"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {dbStats?.totalBytes ? `${dbStats.totalBytes.toLocaleString()} bytes` : "Storage usage"}
                    </div>
                  </div>

                  {/* Metric 3: Total Tables */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Managed Tables
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {dbStats?.tableCount || 0} Tables
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
                      Schema: {dbStats?.databaseName || "golden_dragon_corp"}
                    </div>
                  </div>

                  {/* Metric 4: Total Records Count */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Total Records
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {dbStats?.totalRows ? dbStats.totalRows.toLocaleString() : 0} Rows
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Active database records
                    </div>
                  </div>
                </div>

                {/* Table-by-Table Breakdown Grid */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <span>🗂️</span>
                      <span>Database Tables ({dbStats?.tables?.length || 0})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Click any card to inspect rows</span>
                  </div>

                  {dbStatsLoading && !dbStats ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Inspecting database tables and storage...
                    </div>
                  ) : !dbStats?.tables || dbStats.tables.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 italic text-xs">
                      No tables found in current database schema.
                    </div>
                  ) : (
                    (() => {
                      const maxBytes = Math.max(...dbStats.tables.map((t) => t.totalBytes || 1), 1);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {dbStats.tables.map((tbl) => {
                            const pctOfLargest = Math.max(4, Math.round((tbl.totalBytes / maxBytes) * 100));

                            return (
                              <div
                                key={tbl.name}
                                onClick={() => handleOpenTableData(tbl.name)}
                                className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-lg transition flex flex-col justify-between gap-2.5 group cursor-pointer"
                                title={`Click to inspect records in '${tbl.name}'`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-7 h-7 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center text-xs shrink-0">
                                        📄
                                      </span>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition">
                                          {tbl.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          Table Schema
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-300 px-1.5 py-0.5 bg-slate-800 rounded shrink-0">
                                      {tbl.sizeFormatted}
                                    </span>
                                  </div>

                                  {/* Relative Footprint Visual Bar */}
                                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500/80 rounded-full transition-all duration-500"
                                      style={{ width: `${pctOfLargest}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Table Record & Size Details */}
                                <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-400">
                                  <span>{tbl.rows.toLocaleString()} rows</span>
                                  <span className="text-slate-300 group-hover:text-white transition">
                                    View Data ↗
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
      )}

          {/* ── MODULE 3: MAP & LOT COORDINATE DIAGNOSTICS ── */}
          {activeSidebarTab === "MAP" && (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-teal-400 flex items-center justify-center text-lg shrink-0">
                    🗺️
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Map & Lot Coordinate Diagnostics</h2>
                    <p className="text-[11px] text-slate-400">Scan 2D polygon geometries, detect missing lot coordinates, and verify map readiness.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Coverage badge */}
                  {mapDiag && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {mapDiag.overallCoveragePct}% Ready ({mapDiag.mappedCount}/{mapDiag.totalLots} Lots)
                    </span>
                  )}

                  {/* Scan / Refresh Button */}
                  <button
                    onClick={fetchMapDiagnostics}
                    disabled={mapDiagLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className={mapDiagLoading ? "animate-spin text-teal-400" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{mapDiagLoading ? "Scanning..." : "Scan & Diagnostics"}</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Metric 1: Overall Map Coverage */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Map Coverage
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {mapDiag ? `${mapDiag.overallCoveragePct}%` : "--"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {mapDiag ? `${mapDiag.mappedCount} of ${mapDiag.totalLots} Lots Geocoded` : "Scanning..."}
                    </div>
                  </div>

                  {/* Metric 2: Valid Polygons */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Valid Polygons
                    </div>
                    <div className="text-lg font-bold text-slate-200 font-mono">
                      {mapDiag?.polygonCount || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Full 2D boundary points
                    </div>
                  </div>

                  {/* Metric 3: Missing Coordinates */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Unmapped Lots
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {mapDiag?.unmappedCount || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Missing database coordinates
                    </div>
                  </div>

                  {/* Metric 4: Corrupted / Broken */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Geometry Warnings
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {mapDiag?.corruptedCount || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Syntax integrity status
                    </div>
                  </div>
                </div>

                {/* Subdivision-by-Subdivision Coverage Breakdown */}
                {mapDiag?.propertyBreakdown && mapDiag.propertyBreakdown.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <span>📐</span>
                      <span>Subdivision Coverage ({mapDiag.propertyBreakdown.length} Properties)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mapDiag.propertyBreakdown.map((prop) => (
                        <div
                          key={prop.propertyId}
                          className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-200 truncate">
                                {prop.propertyName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {prop.location || "Location not set"}
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-300 px-2 py-0.5 bg-slate-800 rounded shrink-0">
                              {prop.coveragePct}%
                            </span>
                          </div>

                          {/* Coverage Progress Bar */}
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                prop.coveragePct === 100
                                  ? "bg-emerald-500/80"
                                  : prop.coveragePct > 0
                                  ? "bg-sky-500/80"
                                  : "bg-slate-700"
                              }`}
                              style={{ width: `${Math.max(3, prop.coveragePct)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                            <span>{prop.mappedLots} / {prop.totalLots} lots mapped</span>
                            {prop.unmappedLots > 0 && (
                              <span className="text-amber-400">
                                {prop.unmappedLots} unmapped
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

            {/* Flagged / Unmapped Lots Section - Only visible if there are issues */}
            {mapDiag && mapDiag.flaggedLots && mapDiag.flaggedLots.length > 0 && (
              <div className="border-t border-slate-800/80 pt-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Flagged & Unmapped Lots ({mapDiag.flaggedLots.length})
                    </h3>
                    <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.2 rounded-full">
                      Action Required
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      onClick={() => setMapDiagFilter("ALL")}
                      className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                        mapDiagFilter === "ALL"
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      All ({mapDiag.flaggedLots.length})
                    </button>
                    {mapDiag.unmappedCount > 0 && (
                      <button
                        onClick={() => setMapDiagFilter("UNMAPPED")}
                        className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                          mapDiagFilter === "UNMAPPED"
                            ? "bg-amber-500/20 text-amber-400 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Missing ({mapDiag.unmappedCount})
                      </button>
                    )}
                    {mapDiag.corruptedCount > 0 && (
                      <button
                        onClick={() => setMapDiagFilter("CORRUPTED")}
                        className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                          mapDiagFilter === "CORRUPTED"
                            ? "bg-rose-500/20 text-rose-400 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Corrupted ({mapDiag.corruptedCount})
                      </button>
                    )}
                    <button
                      onClick={() => setShowFlaggedLotsList(!showFlaggedLotsList)}
                      className="text-slate-500 hover:text-slate-300 ml-2 text-xs"
                    >
                      {showFlaggedLotsList ? "Hide List ▲" : "Show List ▼"}
                    </button>
                  </div>
                </div>

                {showFlaggedLotsList && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {mapDiag.flaggedLots
                      .filter((lot) => mapDiagFilter === "ALL" || lot.issueType === mapDiagFilter)
                      .map((lot) => (
                        <div
                          key={lot.lotId}
                          className="p-3 bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                              #{lot.lotNumber}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">
                                  {lot.propertyName} • Lot {lot.lotNumber}
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {lot.areaSqm ? `${lot.areaSqm} sqm` : "Area not set"}
                                </span>
                                <span className={`text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded uppercase ${
                                  lot.status === "AVAILABLE"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}>
                                  {lot.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {lot.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              lot.severity === "danger"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}>
                              {lot.issue}
                            </span>
                            <button
                              onClick={() => handleOpenTableData("lots")}
                              className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                              title="Inspect in lots table"
                            >
                              Inspect ↗
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}

          {/* ── MODULE 4: ACCOUNT DIRECTORY & CREDENTIALS MANAGEMENT ── */}
          {activeSidebarTab === "ACCOUNTS" && (
            <div id="zone-admins" className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden scroll-mt-6 animate-in fade-in duration-150">
          {/* Header & Tabs */}
          <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Account Directory & Credentials Override
              </h2>
              <p className="text-xs text-slate-400">Manage administrator & employee accounts, provision access, and perform instant password overrides</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAccountTab("ADMINS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  accountTab === "ADMINS"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🛡️</span>
                <span>Admins</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
                  {admins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAccountTab("EMPLOYEES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  accountTab === "EMPLOYEES"
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>👔</span>
                <span>Employees / Agents</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
                  {employees.length}
                </span>
              </button>
            </div>
          </div>

          {/* Tab 1: Admins */}
          {accountTab === "ADMINS" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 animate-in fade-in duration-150">
              {/* Left: Create Admin Form (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-1">Provision New Admin</h3>
                <p className="text-xs text-slate-400 mb-4">Add new administrator credentials directly into the database.</p>

                <form onSubmit={handleCreateAdmin} autoComplete="off" className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      autoComplete="off"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@goldendragon.com"
                      autoComplete="off"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                      >
                        {showAdminPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {adminError && <div className="text-red-400 text-xs font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{adminError}</div>}
                  {adminSuccess && <div className="text-emerald-400 text-xs font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">{adminSuccess}</div>}

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {adminLoading ? "Registering Admin..." : "Create Admin Account"}
                  </button>
                </form>
              </div>

              {/* Right: Registered Admins List (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Active Administrator Accounts</h3>
                  <p className="text-xs text-slate-400 mb-4">Direct records extracted from the platform database.</p>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {admins.length === 0 ? (
                      <div className="text-slate-500 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                        No admin accounts found.
                      </div>
                    ) : (
                      admins.map((adm) => (
                        <div
                          key={adm.admin_id}
                          className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              {(adm.full_name || "A").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{adm.full_name || "Administrator"}</div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">{adm.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                              ID #{adm.admin_id}
                            </span>

                            <button
                              onClick={() => {
                                setSelectedAdmin(adm);
                                setIsEditingAdmin(false);
                                setShowDeleteConfirm(false);
                                setCopiedEmail(false);
                                setResetPasswordVal("");
                                setResetMsg({ text: "", isError: false });
                              }}
                              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                              title="View account details"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              View
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Click "View" on any admin to inspect or modify account credentials.</span>
                  <span className="font-mono text-slate-400 font-semibold">{admins.length} Total</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Employees / Agents */}
          {accountTab === "EMPLOYEES" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 animate-in fade-in duration-150">
              {/* Left: Create Employee Form (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-1">Provision New Employee / Agent</h3>
                <p className="text-xs text-slate-400 mb-4">Add new employee or field agent credentials directly into database.</p>

                <form onSubmit={handleCreateEmployee} autoComplete="off" className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                      <input
                        type="text"
                        value={empFirstName}
                        onChange={(e) => setEmpFirstName(e.target.value)}
                        placeholder="Juan"
                        autoComplete="off"
                        className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={empLastName}
                        onChange={(e) => setEmpLastName(e.target.value)}
                        placeholder="Dela Cruz"
                        autoComplete="off"
                        className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      placeholder="employee@goldendragon.com"
                      autoComplete="off"
                      className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (Optional)</label>
                    <input
                      type="text"
                      value={empPhone}
                      onChange={(e) => setEmpPhone(e.target.value)}
                      placeholder="09123456789"
                      autoComplete="off"
                      className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showEmpPassword ? "text" : "password"}
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                        className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmpPassword(!showEmpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                      >
                        {showEmpPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {empFormError && <div className="text-red-400 text-xs font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{empFormError}</div>}
                  {empFormSuccess && <div className="text-teal-300 text-xs font-medium bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/20">{empFormSuccess}</div>}

                  <button
                    type="submit"
                    disabled={empFormLoading}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {empFormLoading ? "Registering Employee..." : "Create Employee Account"}
                  </button>
                </form>
              </div>

              {/* Right: Registered Employees List (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-0.5">Active Employee Accounts</h3>
                      <p className="text-xs text-slate-400">Registered staff & agents with active portal access.</p>
                    </div>
                  </div>

                  {/* Search Filter */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      placeholder="Search employees by name, email, or phone..."
                      className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:border-teal-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                    {employees.length === 0 ? (
                      <div className="text-slate-500 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                        No employee accounts found.
                      </div>
                    ) : (
                      employees
                        .filter((emp) => {
                          if (!employeeSearchQuery.trim()) return true;
                          const q = employeeSearchQuery.toLowerCase();
                          const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
                          const email = (emp.email || "").toLowerCase();
                          const phone = (emp.phone_number || "").toLowerCase();
                          return fullName.includes(q) || email.includes(q) || phone.includes(q);
                        })
                        .map((emp) => (
                          <div
                            key={emp.employee_id}
                            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 transition group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                {(emp.first_name || "E").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{emp.first_name} {emp.last_name}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">{emp.email}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {emp.phone_number && (
                                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                                  📞 {emp.phone_number}
                                </span>
                              )}
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                                ID #{emp.employee_id}
                              </span>

                              <button
                                onClick={() => handleOpenEmployeeModal(emp)}
                                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                                title="Manage employee and override password"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <circle cx="12" cy="16" r="1" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Manage
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Click "Manage" on any employee for instant password overrides or details.</span>
                  <span className="font-mono text-slate-400 font-semibold">{employees.length} Total</span>
                </div>
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      </main>

        {/* ──────── ADMIN ACCOUNT DETAIL INSPECTION & EDIT MODAL ──────── */}
        {selectedAdmin && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center bg-slate-950/90 px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  {isEditingAdmin ? "Edit Admin Account" : "Admin Account Details"}
                </div>

                <div className="flex items-center gap-2">
                  {!isEditingAdmin && !showDeleteConfirm && (
                    <>
                      <button
                        onClick={() => handleStartEdit(selectedAdmin)}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                        title="Edit Full Name or Email"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                      </button>

                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5 font-medium"
                        title="Delete Admin Account"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setSelectedAdmin(null);
                      setIsEditingAdmin(false);
                      setShowDeleteConfirm(false);
                      setResetPasswordVal("");
                      setResetMsg({ text: "", isError: false });
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* ── DELETE CONFIRMATION BANNER ── */}
                {showDeleteConfirm && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2.5 text-rose-400 font-bold text-xs">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Confirm Permanent Deletion
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Are you sure you want to delete <span className="text-white font-bold">{selectedAdmin.full_name || selectedAdmin.email}</span> (ID #{selectedAdmin.admin_id})? This will remove administrator access immediately.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleDeleteAdmin}
                        disabled={deleteLoading}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-500/20 disabled:opacity-50"
                      >
                        {deleteLoading ? "Deleting..." : "Yes, Delete Admin"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ── EDIT MODE FORM ── */}
                {isEditingAdmin ? (
                  <form onSubmit={handleSaveEditAdmin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        placeholder="e.g. John Doe"
                        autoComplete="off"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="admin@goldendragon.com"
                        autoComplete="off"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                      />
                    </div>

                    {editMsg.text && (
                      <div className={`text-xs font-medium p-2.5 rounded-xl border ${editMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                        {editMsg.text}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={editLoading}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      >
                        {editLoading ? "Saving Changes..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingAdmin(false)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Admin Header Card */}
                    <div className="flex items-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <div className="w-13 h-13 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        {(selectedAdmin.full_name || "A").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white truncate">{selectedAdmin.full_name || "System Administrator"}</h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Role: Admin
                        </span>
                      </div>
                    </div>

                    {/* Details Rows */}
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Database Admin ID</span>
                        <span className="font-mono text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          #{selectedAdmin.admin_id}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Full Name</span>
                        <span className="text-slate-200 font-medium">{selectedAdmin.full_name || "N/A"}</span>
                      </div>

                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Email Address</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200 font-medium">{selectedAdmin.email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedAdmin.email);
                              setCopiedEmail(true);
                              setTimeout(() => setCopiedEmail(false), 2000);
                            }}
                            className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                          >
                            {copiedEmail ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Developer Password Reset Section */}
                    <div className="pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          Set New Password
                        </span>
                        <span className="text-[10px] text-slate-500">Developer Override</span>
                      </div>

                      <form onSubmit={handleResetAdminPassword} className="space-y-2.5">
                        <div className="relative">
                          <input
                            type={showResetPassword ? "text" : "password"}
                            value={resetPasswordVal}
                            onChange={(e) => setResetPasswordVal(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            autoComplete="new-password"
                            className="w-full text-xs px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                          >
                            {showResetPassword ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {resetMsg.text && (
                          <div className={`text-xs font-medium p-2 rounded-lg border ${resetMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                            {resetMsg.text}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={resetLoading || !resetPasswordVal.trim()}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 disabled:opacity-40"
                        >
                          {resetLoading ? "Updating Password..." : "Update Password"}
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-950/90 px-6 py-3.5 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  onClick={() => {
                    setSelectedAdmin(null);
                    setIsEditingAdmin(false);
                    setShowDeleteConfirm(false);
                    setResetPasswordVal("");
                    setResetMsg({ text: "", isError: false });
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── EMPLOYEE ACCOUNT DETAIL & INSTANT OVERRIDE MODAL ──────── */}
        {selectedEmployee && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center bg-slate-950/90 px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <circle cx="12" cy="16" r="1" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {isEditingEmployee ? "Edit Employee Account" : "Employee Security & Credentials"}
                </div>

                <div className="flex items-center gap-2">
                  {!isEditingEmployee && !showDeleteEmpConfirm && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditingEmployee(true);
                          setEmpModalMsg({ text: "", isError: false });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                        title="Edit Employee Details"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                      </button>

                      <button
                        onClick={() => setShowDeleteEmpConfirm(true)}
                        className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5 font-medium"
                        title="Delete Employee Account"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleCloseEmployeeModal}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Delete Confirmation */}
                {showDeleteEmpConfirm && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2.5 text-rose-400 font-bold text-xs">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Confirm Permanent Deletion
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Are you sure you want to delete <span className="text-white font-bold">{selectedEmployee.first_name} {selectedEmployee.last_name}</span> (ID #{selectedEmployee.employee_id})? This will revoke their employee login access.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleDeleteEmployee}
                        disabled={empModalLoading}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-500/20 disabled:opacity-50"
                      >
                        {empModalLoading ? "Deleting..." : "Yes, Delete Employee"}
                      </button>
                      <button
                        onClick={() => setShowDeleteEmpConfirm(false)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit Profile Mode */}
                {isEditingEmployee ? (
                  <form onSubmit={handleUpdateEmployee} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                        <input
                          type="text"
                          value={editEmpFirstName}
                          onChange={(e) => setEditEmpFirstName(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-teal-500 outline-none transition text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editEmpLastName}
                          onChange={(e) => setEditEmpLastName(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-teal-500 outline-none transition text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editEmpEmail}
                        onChange={(e) => setEditEmpEmail(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-teal-500 outline-none transition text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editEmpPhone}
                        onChange={(e) => setEditEmpPhone(e.target.value)}
                        placeholder="e.g. 09123456789"
                        className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-teal-500 outline-none transition text-white"
                      />
                    </div>

                    {empModalMsg.text && (
                      <div className={`text-xs font-medium p-2.5 rounded-xl border ${empModalMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-teal-300 bg-teal-500/10 border-teal-500/20"}`}>
                        {empModalMsg.text}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={empModalLoading}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50"
                      >
                        {empModalLoading ? "Saving Changes..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmployee(false)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Employee Profile Header Card */}
                    <div className="flex items-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <div className="w-13 h-13 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        {(selectedEmployee.first_name || "E").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white truncate">
                          {selectedEmployee.first_name} {selectedEmployee.last_name}
                        </h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          Role: Employee / Agent
                        </span>
                      </div>
                    </div>

                    {/* Details Rows */}
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Employee Database ID</span>
                        <span className="font-mono text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          #{selectedEmployee.employee_id}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Email Address</span>
                        <span className="font-mono text-slate-200 font-medium">{selectedEmployee.email}</span>
                      </div>

                      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Contact Phone</span>
                        <span className="text-slate-200 font-medium">{selectedEmployee.phone_number || "Not provided"}</span>
                      </div>
                    </div>

                    {/* ⚡ Instant Password Override Section */}
                    <div className="pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <circle cx="12" cy="16" r="1" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          Instant Password Override
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateRandomEmpPassword}
                          className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 underline transition"
                        >
                          ⚡ Generate Random PIN
                        </button>
                      </div>

                      <form onSubmit={handleResetEmployeePassword} className="space-y-2.5">
                        <div className="relative">
                          <input
                            type={showEmpNewPassword ? "text" : "password"}
                            value={empNewPassword}
                            onChange={(e) => setEmpNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            autoComplete="new-password"
                            className="w-full text-xs px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500 pr-10 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmpNewPassword(!showEmpNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                          >
                            {showEmpNewPassword ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {empModalMsg.text && (
                          <div className={`text-xs font-medium p-2.5 rounded-xl border ${empModalMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-teal-300 bg-teal-500/10 border-teal-500/20"}`}>
                            {empModalMsg.text}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={empModalLoading || !empNewPassword.trim()}
                          className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/10 disabled:opacity-40"
                        >
                          {empModalLoading ? "Applying New Password..." : "Override & Set New Password"}
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-950/90 px-6 py-3.5 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  onClick={handleCloseEmployeeModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── TABLE DATA EXPLORER MODAL (EXPANSIVE & SPATIOUS STUDIO) ──────── */}
        {selectedTable && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
            <div className="bg-slate-950 border border-slate-800/90 w-[96vw] max-w-[1750px] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/95 px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border shrink-0 shadow-sm ${getTableIcon(selectedTable).color}`}>
                    {getTableIcon(selectedTable).icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {selectedTable}
                      </h3>
                      <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tableData ? `${tableData.totalRows.toLocaleString()} Records` : "Loading..."}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Live database rows extracted directly from Aiven Cloud MySQL</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                  {/* Search Query Input */}
                  {tableData && tableData.rows && tableData.rows.length > 0 && (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="12" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        placeholder="Filter rows..."
                        className="text-xs pl-8 pr-7 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-200 placeholder-slate-500 w-48 sm:w-64 transition"
                      />
                      {tableSearchQuery && (
                        <button
                          onClick={() => setTableSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Export JSON Button */}
                  {tableData && tableData.rows && tableData.rows.length > 0 && (
                    <button
                      onClick={() => handleDownloadTableJson(selectedTable, tableData.rows)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center gap-1.5 shadow-sm"
                      title="Download rows as JSON"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export JSON
                    </button>
                  )}

                  {/* Close Modal Button */}
                  <button
                    onClick={() => {
                      setSelectedTable(null);
                      setTableData(null);
                      setTableSearchQuery("");
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body: Spacious & Scrollable Studio Table */}
              <div className="flex-1 overflow-auto bg-[#070b14] p-4 sm:p-6">
                {tableDataLoading ? (
                  <div className="flex flex-col items-center justify-center py-28 text-slate-500 gap-3">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="animate-spin text-emerald-400">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span className="text-xs font-mono text-slate-400">Loading records from '{selectedTable}'...</span>
                  </div>
                ) : !tableData || !tableData.rows || tableData.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 italic text-xs border border-dashed border-slate-800 rounded-2xl">
                    No records found in '{selectedTable}' table.
                  </div>
                ) : (
                  (() => {
                    const filteredRows = tableData.rows.filter((row) => {
                      if (!tableSearchQuery.trim()) return true;
                      const q = tableSearchQuery.toLowerCase();
                      return Object.values(row).some((val) =>
                        val !== null && val !== undefined && val.toString().toLowerCase().includes(q)
                      );
                    });

                    if (filteredRows.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 italic text-xs bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                          <span>No rows match '{tableSearchQuery}'.</span>
                          <button
                            onClick={() => setTableSearchQuery("")}
                            className="mt-2 text-xs text-emerald-400 hover:underline"
                          >
                            Clear search filter
                          </button>
                        </div>
                      );
                    }

                    const primaryKeyCol = tableData.columns.find((c) => c.isPrimary) || tableData.columns[0];

                    return (
                      <div className="border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl bg-slate-950/60 w-full">
                        <div className="overflow-x-auto w-full">
                          <table className="w-full min-w-max text-left border-collapse text-xs">
                            {/* Clean Table Header */}
                            <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400">
                              <tr>
                                <th className="py-3 px-4 font-mono text-[11px] text-slate-500 w-12 text-center select-none min-w-[48px]">
                                  #
                                </th>
                                {tableData.columns.map((col) => (
                                  <th
                                    key={col.name}
                                    className="py-3 px-5 font-semibold text-slate-300 whitespace-nowrap min-w-[150px]"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {col.isPrimary && (
                                        <span title="Primary Key" className="text-amber-400 text-xs">🔑</span>
                                      )}
                                      <span className="font-semibold text-slate-200 tracking-tight text-xs">{col.name}</span>
                                    </div>
                                  </th>
                                ))}
                                <th className="py-3 px-4 font-semibold text-slate-400 text-center w-16 min-w-[70px] sticky right-0 bg-slate-900/95 border-l border-slate-800 select-none">
                                  Action
                                </th>
                              </tr>
                            </thead>

                            {/* Clean Rows */}
                            <tbody className="divide-y divide-slate-800/40 text-xs">
                              {filteredRows.map((row, rowIdx) => (
                                <tr
                                  key={rowIdx}
                                  className="hover:bg-slate-900/30 transition-colors group"
                                >
                                  <td className="py-3 px-4 text-slate-500 text-center font-mono text-[11px] select-none">
                                    {rowIdx + 1}
                                  </td>
                                  {tableData.columns.map((col) => {
                                    const val = row[col.name];
                                    return (
                                      <td
                                        key={col.name}
                                        className="py-3 px-5 text-slate-300 align-middle whitespace-nowrap min-w-[150px]"
                                      >
                                        {renderTableExplorerCell(col, val)}
                                      </td>
                                    );
                                  })}
                                  {/* Row Action: Delete */}
                                  <td className="py-3 px-4 text-center sticky right-0 bg-slate-950/95 border-l border-slate-800/60 min-w-[70px]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const pkVal = row[primaryKeyCol.name];
                                        const label = row.full_name || row.email || row.lot_number || `ID #${pkVal}`;
                                        setRowToDelete({
                                          tableName: selectedTable,
                                          primaryKey: primaryKeyCol.name,
                                          primaryKeyValue: pkVal,
                                          rowSummary: `${primaryKeyCol.name} #${pkVal} (${label})`,
                                        });
                                      }}
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
                                      title={`Delete record #${row[primaryKeyCol.name]} from ${selectedTable}`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-950/95 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-300 font-semibold">
                    {tableData ? `${tableData.rows?.length || 0} rows` : ""}
                  </span>
                  {tableSearchQuery && (
                    <span className="text-emerald-400 font-mono text-[11px]">
                      (Filtered query active)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    setTableData(null);
                    setTableSearchQuery("");
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition shadow-sm"
                >
                  Close Explorer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── SINGLE ROW DELETE CONFIRMATION MODAL ──────── */}
        {rowToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-500/40 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Table Record</h3>
                  <p className="text-xs text-slate-400">Permanently delete record from database</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Target Table:</span>
                  <span className="font-mono text-white font-bold">{rowToDelete.tableName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Record:</span>
                  <span className="font-mono text-rose-400 font-semibold">{rowToDelete.rowSummary}</span>
                </div>
              </div>

              {rowToDelete.tableName.toLowerCase() === "customers" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
                  ⚠️ Deleting this customer will also delete their related transactions in the transaction history and reset lot status if applicable.
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRowToDelete(null)}
                  disabled={rowDeleteLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRowConfirm}
                  disabled={rowDeleteLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50"
                >
                  {rowDeleteLoading ? "Deleting Record..." : "Confirm & Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── PURGE ALL TEST DATA CONFIRMATION MODAL ──────── */}
        {showPurgeModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-500/50 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 text-xl">
                  🧹
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Purge All Test Data</h3>
                  <p className="text-xs text-slate-400">Prepare database for Production launch</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                This action will wipe all test buyer inquiries, customers, and payment transaction histories from the database.
              </p>

              <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="text-rose-400 font-semibold flex items-center gap-2">
                  <span>❌</span> What will be deleted:
                </div>
                <ul className="text-slate-400 list-disc list-inside space-y-1 text-[11px]">
                  <li>All records in <strong className="text-slate-200">customers</strong> table</li>
                  <li>All records in <strong className="text-slate-200">transactions</strong> table</li>
                  <li>Reset all lot statuses back to <strong className="text-emerald-400">Available</strong></li>
                </ul>

                <div className="text-emerald-400 font-semibold flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <span>🛡️</span> What will be PROTECTED & KEPT:
                </div>
                <ul className="text-slate-400 list-disc list-inside space-y-1 text-[11px]">
                  <li>All subdivision properties & lot coordinates / map geometries</li>
                  <li>All administrator & employee accounts</li>
                </ul>
              </div>

              {purgeSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
                  {purgeSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(false)}
                  disabled={purgeLoading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePurgeTestDataConfirm}
                  disabled={purgeLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {purgeLoading ? "Purging Test Data..." : "Yes, Purge Test Data"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── CAPSTONE DEMO SEED DATA GENERATOR MODAL ──────── */}
        {showDemoDataModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-emerald-500/40 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 text-xl">
                  🎲
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Capstone Demo Data Generator</h3>
                  <p className="text-xs text-slate-400">Generate realistic inquiries & sales for defense/demo</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                This tool will automatically create realistic sample buyer accounts and map transactions across your subdivision lots to make your Admin Dashboard charts, sales revenue, and lot status maps look active and full during live presentations.
              </p>

              {/* Quantity Selector */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Number of sample transactions to generate:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setDemoDataCount(num)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        demoDataCount === num
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <span>✨</span> {num} Records
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span>✓</span> Auto-generates:
                </div>
                <p>• Realistic Filipino buyer names, emails, contact numbers, & addresses.</p>
                <p>• Mix of Cash, Installment, and No Downpayment transactions.</p>
                <p>• Lots will update to <strong>Sold</strong> or <strong>Pending</strong> with past timestamps.</p>
              </div>

              {demoDataSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-medium">
                  🎉 {demoDataSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDemoDataModal(false)}
                  disabled={demoDataLoading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleGenerateDemoDataConfirm}
                  disabled={demoDataLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {demoDataLoading ? "Generating Records..." : "🎲 Generate Demo Data"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── EMERGENCY GLOBAL KILL SWITCH CONFIRMATION MODAL ──────── */}
        {showKillSwitchModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 border border-rose-500/40 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl shrink-0">
                  🛑
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm Global Force Logout</h3>
                  <p className="text-xs text-rose-400 font-medium">Emergency Session & JWT Invalidation</p>
                </div>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-rose-300">
                  ⚠️ This action will immediately terminate ALL active login sessions across every Admin and Employee account.
                </p>
                <p>
                  Every user currently logged in will have their JWT authentication tokens revoked and will be kicked back to the login screen on their next interaction.
                </p>
              </div>

              {lastKillSwitchTime && (
                <div className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  Last Revocation Trigger: {new Date(lastKillSwitchTime).toLocaleString()}
                </div>
              )}

              {killSwitchSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-medium">
                  🎉 {killSwitchSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKillSwitchModal(false)}
                  disabled={killSwitchLoading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTriggerKillSwitch}
                  disabled={killSwitchLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {killSwitchLoading ? "Revoking All Sessions..." : "🛑 Yes, Force Logout All"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── DEDICATED CATEGORY LOG INSPECTOR MODAL ──────── */}
        {selectedLogCategory && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[65] flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 border border-slate-700/80 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-lg shrink-0">
                    {selectedLogCategory === "AUTH" && "👥"}
                    {selectedLogCategory === "SECURITY" && "🚨"}
                    {selectedLogCategory === "DATABASE" && "💾"}
                    {selectedLogCategory === "SYSTEM" && "🛠️"}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedLogCategory === "AUTH" && "User & Staff Access Logs"}
                      {selectedLogCategory === "SECURITY" && "Security & Revocation Audit Logs"}
                      {selectedLogCategory === "DATABASE" && "Database & Seed Operations Logs"}
                      {selectedLogCategory === "SYSTEM" && "System & Maintenance Gate Logs"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedLogCategory === "AUTH" && "Detailed audit trail of administrator, employee, and developer logins and session terminations."}
                      {selectedLogCategory === "SECURITY" && "High-priority security alerts, Global Kill Switch triggers, and token revocations."}
                      {selectedLogCategory === "DATABASE" && "Capstone demo data generations, customer & transaction purges, and SQL backup exports."}
                      {selectedLogCategory === "SYSTEM" && "Maintenance mode 503 lock toggles, developer PIN updates, and server events."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLogCategory(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Filter & Action Toolbar */}
              <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative w-full sm:w-80">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                  <input
                    type="text"
                    value={logModalSearch}
                    onChange={(e) => setLogModalSearch(e.target.value)}
                    placeholder="Search by email, action, device, or IP..."
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-8 pr-3 py-2 outline-none focus:border-slate-600 transition placeholder-slate-500"
                  />
                  {logModalSearch && (
                    <button
                      onClick={() => setLogModalSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Right Action: Clear Category Logs */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {showClearCategoryConfirm ? (
                    <div className="flex items-center gap-2 animate-in fade-in">
                      <span className="text-xs text-rose-400 font-medium">Clear all in this category?</span>
                      <button
                        type="button"
                        onClick={() => handleClearCategoryLogs(selectedLogCategory)}
                        disabled={clearCategoryLoading}
                        className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition disabled:opacity-50"
                      >
                        {clearCategoryLoading ? "Clearing..." : "Yes, Clear"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearCategoryConfirm(false)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearCategoryConfirm(true)}
                      className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Clear Category Logs
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Body: Scrollable Log List */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[#030712] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {(() => {
                  let categoryLogs = logs.filter((log) => {
                    const type = (log.type || "").toUpperCase();
                    const event = log.event || "";
                    if (selectedLogCategory === "AUTH") return type === "AUTH";
                    if (selectedLogCategory === "SECURITY") return ["SECURITY", "ERROR", "CRASH"].includes(type) || event.includes("KILL SWITCH") || event.includes("System Error");
                    if (selectedLogCategory === "DATABASE") return type === "DATABASE" || type === "BACKUP" || event.includes("demo") || event.includes("Capstone") || event.includes("Purge");
                    if (selectedLogCategory === "SYSTEM") return ["MAINTENANCE", "SYSTEM", "ADMIN", "EMAIL"].includes(type);
                    return true;
                  });

                  if (logModalSearch.trim()) {
                    const q = logModalSearch.toLowerCase();
                    categoryLogs = categoryLogs.filter((log) => {
                      const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
                      const user = String(log.user || "").toLowerCase();
                      const role = String(log.role || "").toLowerCase();
                      const device = String(log.device || "").toLowerCase();
                      const ip = String(log.ip || "").toLowerCase();
                      return (
                        eventStr.toLowerCase().includes(q) ||
                        user.includes(q) ||
                        role.includes(q) ||
                        device.includes(q) ||
                        ip.includes(q)
                      );
                    });
                  }

                  if (categoryLogs.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3">
                          {logModalSearch ? "🔍" : "📁"}
                        </div>
                        <p className="text-sm font-semibold text-slate-300">
                          {logModalSearch ? `No logs found matching "${logModalSearch}"` : "No logs recorded in this category yet."}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {logModalSearch ? "Try adjusting your search keywords." : "Actions matching this category will appear here automatically."}
                        </p>
                      </div>
                    );
                  }

                  return categoryLogs.map((log, idx) => {
                    const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
                    const isLogin = eventStr.toLowerCase().includes("logged in") || eventStr.toLowerCase().includes("authenticated");
                    const isLogout = eventStr.toLowerCase().includes("logged out") || eventStr.toLowerCase().includes("force logout");
                    const isKillSwitch = eventStr.includes("KILL SWITCH") || eventStr.includes("Force-logged out");
                    const isError = (log.type || "").toUpperCase() === "ERROR" || (log.type || "").toUpperCase() === "CRASH" || eventStr.includes("System Error") || eventStr.includes("Exception");
                    const isEmail = (log.type || "").toUpperCase() === "EMAIL";
                    const rawRole = String(log.role || "").toLowerCase();
                    const rawUser = String(log.user || "").toLowerCase();

                    let roleBadgeColor = "bg-slate-800 text-slate-400 border-slate-700";
                    let roleLabel = "User";
                    let roleIcon = "👤";

                    if (rawRole === "developer" || rawUser.includes("developer")) {
                      roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                      roleLabel = "Developer";
                      roleIcon = "🛡️";
                    } else if (rawRole === "admin") {
                      roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                      roleLabel = "Admin";
                      roleIcon = "👑";
                    } else if (rawRole === "employee") {
                      roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                      roleLabel = "Employee";
                      roleIcon = "👔";
                    }

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-800/90 hover:border-slate-700 bg-slate-900/60 transition flex items-start gap-3.5"
                      >
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm border bg-slate-800 border-slate-700 text-slate-300 mt-0.5">
                          {isKillSwitch ? "🛑" : isError ? "❌" : isLogin ? "🟢" : isLogout ? "👋" : isEmail ? "📧" : selectedLogCategory === "DATABASE" ? "💾" : "⚙️"}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                            <div className="flex items-center gap-2">
                              {log.user ? (
                                <>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${roleBadgeColor}`}>
                                    <span>{roleIcon}</span>
                                    <span>{roleLabel}</span>
                                  </span>
                                  <span className="text-xs font-bold text-white">
                                    {log.user}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                  {log.type || "SYSTEM"}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-200 font-medium leading-relaxed break-words">
                            {eventStr}
                          </div>

                          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-3 flex-wrap">
                            {log.device && <span>📱 {log.device}</span>}
                            {log.ip && <span>🌐 IP: {log.ip}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Showing category: <strong className="text-white">{selectedLogCategory}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLogCategory(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default DeveloperPanel;
