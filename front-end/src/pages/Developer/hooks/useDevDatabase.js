import { useState, useCallback } from "react";
import axios from "axios";
import { showToast } from "../../../components/GlobalToast";
import { API_BASE_URL } from "../../../config/api";

const useDevDatabase = (getDevHeaders, fetchSystemState, fetchEmployees) => {
  const [dbLoading, setDbLoading] = useState(false);

  // Live Database Inspector state
  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);

  // Table Data Explorer states
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");

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

  // Fetch live database table stats & latency
  const fetchDbStats = useCallback(async () => {
    setDbStatsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/db-inspector`, {
        headers: getDevHeaders ? getDevHeaders() : {},
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

  // Trigger Database Backup download
  const handleBackupDownload = async () => {
    setDbLoading(true);
    try {
      const response = await axios({
        url: `${API_BASE_URL}/api/developer/backup-db`,
        method: "GET",
        headers: getDevHeaders ? getDevHeaders() : {},
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
      if (fetchSystemState) fetchSystemState();
    } catch (err) {
      showToast("Failed to download database backup: " + (err.message || "Server Error"), "error");
    } finally {
      setDbLoading(false);
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
        headers: getDevHeaders ? getDevHeaders() : {},
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
        headers: getDevHeaders ? getDevHeaders() : {},
        withCredentials: true,
      });

      if (res.data.success) {
        setRowToDelete(null);
        // Refresh active table
        await handleOpenTableData(rowToDelete.tableName);
        // Refresh DB metrics & logs
        fetchDbStats();
        if (fetchSystemState) fetchSystemState();
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
          headers: getDevHeaders ? getDevHeaders() : {},
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
        if (fetchSystemState) fetchSystemState();
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
          headers: getDevHeaders ? getDevHeaders() : {},
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
        if (fetchSystemState) fetchSystemState();
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
        headers: getDevHeaders ? getDevHeaders() : {},
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
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmpSuccessMsg(res.data.message);
        fetchDemoStaffStatus();
        if (fetchEmployees) fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
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
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmployeesList(res.data.employees || []);
        setDemoEmpSuccessMsg(res.data.message || "All demo staff accounts activated successfully!");
        if (fetchEmployees) fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
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
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setDemoEmpSuccessMsg(res.data.message || "All demo staff accounts deactivated.");
        fetchDemoStaffStatus();
        if (fetchEmployees) fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
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

  return {
    dbLoading,
    setDbLoading,
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
    fetchDbStats,
    handleBackupDownload,
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
  };
};

export default useDevDatabase;
