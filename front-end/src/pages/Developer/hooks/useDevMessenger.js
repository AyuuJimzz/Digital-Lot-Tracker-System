import { useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config/api";

const useDevMessenger = (getDevHeaders, fetchSystemState, fetchEnvHealth) => {
  // Facebook Messenger Alert states
  const [messengerTestLoading, setMessengerTestLoading] = useState(false);
  const [messengerTestMsg, setMessengerTestMsg] = useState({ text: "", isError: false });
  const [messengerRecipients, setMessengerRecipients] = useState([]);
  const [fetchRecipientsLoading, setFetchRecipientsLoading] = useState(false);
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
        headers: getDevHeaders ? getDevHeaders() : {},
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
        { headers: getDevHeaders ? getDevHeaders() : {}, withCredentials: true }
      );
      if (res.data?.success) {
        setMessengerTestMsg({
          text: `🔔 ${res.data.message}`,
          isError: false,
        });
        if (fetchSystemState) fetchSystemState();
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
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );
      if (res.data?.success) {
        setMessengerTestMsg({
          text: `✅ Alert Category '${filterKey}' is now ${updated[filterKey] ? "ACTIVE" : "MUTED"}`,
          isError: false,
        });
        if (fetchSystemState) fetchSystemState();
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
        { headers: getDevHeaders ? getDevHeaders() : {}, withCredentials: true }
      );
      if (res.data.success) {
        setMessengerTestMsg({ text: `🗑️ ${res.data.message}`, isError: false });
        setMessengerRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
        setDismissedCount((c) => c + 1);
        if (fetchEnvHealth) fetchEnvHealth();
        if (fetchSystemState) fetchSystemState();
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
        { headers: getDevHeaders ? getDevHeaders() : {}, withCredentials: true }
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
        headers: getDevHeaders ? getDevHeaders() : {},
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
          headers: getDevHeaders ? getDevHeaders() : {},
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
        if (fetchEnvHealth) fetchEnvHealth();
        if (fetchSystemState) fetchSystemState();
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

  return {
    messengerTestLoading,
    setMessengerTestLoading,
    messengerTestMsg,
    setMessengerTestMsg,
    messengerRecipients,
    setMessengerRecipients,
    fetchRecipientsLoading,
    setFetchRecipientsLoading,
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
  };
};

export default useDevMessenger;
