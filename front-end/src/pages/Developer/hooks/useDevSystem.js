import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { showToast } from "../../../components/GlobalToast";
import { API_BASE_URL } from "../../../config/api";

const useDevSystem = (onAuthReady) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Dashboard states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logs, setLogs] = useState([]);
  const [toggleLoading, setToggleLoading] = useState(false);

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

  // Sidebar Layout Navigation state ("SYSTEM" | "ENDPOINTS" | "ENV" | "MESSENGER" | "DATABASE" | "MAP" | "ACCOUNTS")
  const [activeSidebarTab, setActiveSidebarTab] = useState("SYSTEM");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // Helper to attach Developer PIN in request headers
  const getDevHeaders = useCallback(() => {
    const storedPin = sessionStorage.getItem("devPin");
    return storedPin ? { "x-developer-pin": storedPin } : {};
  }, []);

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

  // Clear specific log category
  const handleClearCategoryLogs = async (categoryType) => {
    setClearCategoryLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/clear-logs`,
        { type: categoryType },
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
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

  // Trigger Emergency Global Kill Switch (Force Logout All)
  const handleTriggerKillSwitch = async () => {
    setKillSwitchLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/global-kill-switch`,
        {},
        {
          headers: getDevHeaders(),
          withCredentials: true,
        }
      );
      if (res.data.success) {
        setKillSwitchSuccessMsg(
          "Emergency Kill Switch Triggered! All active sessions have been invalidated immediately."
        );
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
          fetchMapDiagnostics();
          if (onAuthReady) onAuthReady();
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
  }, [fetchMapDiagnostics, onAuthReady]);

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
        fetchMapDiagnostics();
        if (onAuthReady) onAuthReady();
      }
    } catch (err) {
      sessionStorage.removeItem("devPin");
      setError(err.response?.data?.error || "Incorrect Developer PIN");
    } finally {
      setLoading(false);
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
          withCredentials: true,
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
      showToast(
        "Failed to toggle maintenance mode: " + (err.response?.data?.error || "Error"),
        "error"
      );
    } finally {
      setToggleLoading(false);
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
    toggleLoading,
    setToggleLoading,
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
    activeSidebarTab,
    setActiveSidebarTab,
    mobileSidebarOpen,
    setMobileSidebarOpen,
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
    getDevHeaders,
    fetchSystemState,
    handleClearCategoryLogs,
    handleTriggerKillSwitch,
    fetchApiHealth,
    fetchEnvHealth,
    fetchMapDiagnostics,
    handleVerifyPin,
    handleToggleMaintenance,
    handleChangePinSubmit,
  };
};

export default useDevSystem;
