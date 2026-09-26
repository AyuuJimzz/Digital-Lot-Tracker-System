import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { showToast } from "../../components/GlobalToast";
import {
  User,
  Shield,
  CheckCircle,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  History,
  Monitor,
  Smartphone,
  Clock3,
  RefreshCw,
} from "lucide-react";

const formatSignIn = (value) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const SignInRow = ({ entry }) => {
  const DeviceIcon = /iPhone|Android|iPad/i.test(entry.device) ? Smartphone : Monitor;
  const source = ["::1", "127.0.0.1"].includes(entry.ip_address)
    ? "Local device"
    : entry.ip_address ? `IP ${entry.ip_address}` : "IP unavailable";

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
        <DeviceIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.device}</p>
          {entry.is_current && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Current session</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
          {source} · {formatSignIn(entry.signed_in_at)}
        </p>
      </div>
    </div>
  );
};

const ProfileSettings = () => {
  const location = useLocation();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";
  const [activeTab, setActiveTab] = useState(location.state?.tab || "profile");
  const editedFieldsRef = useRef(new Set());

  // Sync tab if user navigates with different state tab
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  // Instant load from sessionStorage cache if available (eliminates Render cold start spinner)
  const [profileData, setProfileData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("userProfileCache");
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          first_name: parsed.first_name || "",
          last_name: parsed.last_name || "",
          email: parsed.email || "",
        };
      }
    } catch (e) {}
    return {
      first_name: "",
      last_name: "",
      email: "",
    };
  });
  const [savedProfileData, setSavedProfileData] = useState(profileData);
  const [loginHistory, setLoginHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const currentLogin = loginHistory.find((entry) => entry.is_current);
  const previousLogins = loginHistory.filter((entry) => !entry.is_current);
  const visiblePreviousLogins = showAllHistory ? previousLogins : previousLogins.slice(0, 2);
  const hasUnsavedChanges = ["first_name", "last_name", "email"].some(
    (field) => profileData[field] !== savedProfileData[field]
  );

  // Only show blocking spinner if we have NO cached profile data at all
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("userProfileCache"));
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
          headers,
          withCredentials: true,
          timeout: 8000,
        });
        if (isMounted && res.data) {
          const mapped = {
            first_name: res.data.first_name || "",
            last_name: res.data.last_name || "",
            email: res.data.email || "",
          };
          setProfileData((current) => {
            if (editedFieldsRef.current.size === 0) return mapped;
            const merged = { ...mapped };
            editedFieldsRef.current.forEach((field) => {
              merged[field] = current[field];
            });
            return merged;
          });
          setSavedProfileData(mapped);
          try {
            sessionStorage.setItem(
              "userProfileCache",
              JSON.stringify(mapped)
            );
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to load profile details:", err);
        // Only show error message if we don't even have cached profile data
        if (isMounted && !sessionStorage.getItem("userProfileCache")) {
          setMessage({
            type: "error",
            text: err.response?.data?.message || "Failed to load profile details. Please try again.",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab !== "history") return undefined;
    let mounted = true;
    setHistoryLoading(true);
    setHistoryError("");
    axios.get(`${API_BASE_URL}/api/auth/login-history`, {
      headers: getAuthHeaders(),
      withCredentials: true,
      timeout: 8000,
    }).then((response) => {
      if (mounted) setLoginHistory(response.data.history || []);
    }).catch((error) => {
      if (mounted) setHistoryError(error.response?.data?.message || "Could not load sign-in history.");
    }).finally(() => {
      if (mounted) setHistoryLoading(false);
    });
    return () => { mounted = false; };
  }, [activeTab, historyReloadKey]);

  const handleProfileChange = (e) => {
    editedFieldsRef.current.add(e.target.name);
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!hasUnsavedChanges) return;
    setMessage({ type: "", text: "" });
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      await axios.put(
        `${API_BASE_URL}/api/auth/profile`,
        {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
        },
        { headers, withCredentials: true }
      );
      setMessage({ type: "success", text: "Profile updated successfully!" });
      showToast("Profile updated successfully!", "success");
      editedFieldsRef.current.clear();
      setSavedProfileData(profileData);
      try {
        sessionStorage.setItem(
          "userProfileCache",
          JSON.stringify(profileData)
        );
      } catch (e) {}
    } catch (err) {
      const errMsg = err.response?.data?.message || "Error updating profile.";
      setMessage({ type: "error", text: errMsg });
      showToast(errMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      showToast("New passwords do not match.", "warning");
      return;
    }

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      await axios.put(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        },
        { headers, withCredentials: true }
      );
      setMessage({ type: "success", text: "Password changed successfully!" });
      showToast("Password changed successfully!", "success");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const errMsg = err.response?.data?.message || "Error changing password.";
      setMessage({
        type: "error",
        text: errMsg,
      });
      showToast(errMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return "?";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "history", label: "Login history", icon: History },
  ];

  const inputClass =
    "w-full min-h-11 px-4 py-2.5 bg-white dark:bg-slate-950/60 border border-gray-300 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-gray-50 transition-colors duration-300 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Account Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Your profile and sign-in details, all in one place.
          </p>
        </header>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-4 border-b border-gray-200 px-5 py-5 dark:border-slate-800 sm:px-8 sm:py-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-lg font-bold tracking-wide text-white ring-4 ring-amber-500/10">
              {getInitials(profileData.first_name, profileData.last_name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                {profileData.first_name || profileData.last_name
                  ? `${profileData.first_name} ${profileData.last_name}`.trim()
                  : "Your account"}
              </h2>
              <p className="truncate text-sm text-gray-500 dark:text-slate-400" title={profileData.email}>
                {profileData.email || "No email address"}
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
              {isAdmin ? "Administrator" : "Employee"}
            </span>
          </div>

          <nav aria-label="Account settings" className="flex gap-6 overflow-x-auto border-b border-gray-200 px-5 dark:border-slate-800 sm:px-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMessage({ type: "", text: "" });
                  }}
                  className={`relative flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                    isActive
                      ? "border-blue-500 text-blue-700 dark:text-blue-300"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section className="min-w-0" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label || "Account"} settings`}>
            {/* Alert */}
            {message.text && (
              <div
                className={`mx-5 mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-8 ${
                  message.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {message.text}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <form onSubmit={saveProfile} className="min-w-0">
                <div className="px-5 pb-1 pt-6 sm:px-8 sm:pt-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h2>
                    {hasUnsavedChanges && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Keep your contact details up to date.
                  </p>
                </div>

                <div className="space-y-6 px-5 pb-8 pt-6 sm:px-8">
                  {/* Name Row */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="settings-first-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                        First Name
                      </label>
                      <input
                        id="settings-first-name"
                        type="text"
                        name="first_name"
                        autoComplete="given-name"
                        value={profileData.first_name}
                        onChange={handleProfileChange}
                        className={inputClass}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-last-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                        Last Name
                      </label>
                      <input
                        id="settings-last-name"
                        type="text"
                        name="last_name"
                        autoComplete="family-name"
                        value={profileData.last_name}
                        onChange={handleProfileChange}
                        className={inputClass}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-email" className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="settings-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        className={`${inputClass} pl-10`}
                        placeholder="you@email.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <p className="text-xs text-gray-500 dark:text-slate-400" aria-live="polite">
                    {hasUnsavedChanges ? "Review your changes before saving." : "Your profile is up to date."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        editedFieldsRef.current.clear();
                        setProfileData(savedProfileData);
                        setMessage({ type: "", text: "" });
                      }}
                      disabled={saving || !hasUnsavedChanges}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !hasUnsavedChanges}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                      {saving && (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <form onSubmit={savePassword} className="min-w-0">
                <div className="px-5 pb-1 pt-6 sm:px-8 sm:pt-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Change Password
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Use a strong password to keep your account secure
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 px-5 pb-8 pt-6 sm:grid-cols-2 sm:px-8">
                  {[
                    { label: "Current Password", name: "currentPassword", show: "current", auto: "current-password" },
                    { label: "New Password", name: "newPassword", show: "new", auto: "new-password" },
                    { label: "Confirm New Password", name: "confirmPassword", show: "confirm", auto: "new-password" },
                  ].map(({ label, name, show, auto }) => (
                    <div key={name} className={name === "currentPassword" ? "sm:col-span-2" : ""}>
                      <label htmlFor={`settings-${name}`} className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                        {label}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input
                          id={`settings-${name}`}
                          type={showPasswords[show] ? "text" : "password"}
                          name={name}
                          autoComplete={auto}
                          value={passwords[name]}
                          onChange={handlePasswordChange}
                          className={`${inputClass} pl-10 pr-10`}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          aria-label={`${showPasswords[show] ? "Hide" : "Show"} ${label.toLowerCase()}`}
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, [show]: !showPasswords[show] })
                          }
                          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                          {showPasswords[show] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end border-t border-gray-100 px-5 py-4 dark:border-slate-800 sm:px-8">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {saving && (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    Update Password
                  </button>
                </div>
              </form>
            )}
            {activeTab === "history" && (
              <div className="px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Login activity</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                      Recent successful sign-ins from the last 90 days.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryReloadKey((key) => key + 1)}
                    disabled={historyLoading}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                    Refresh
                  </button>
                </div>

                {historyLoading ? (
                  <p className="py-10 text-center text-sm text-gray-500 dark:text-slate-400" role="status">Loading sign-ins...</p>
                ) : historyError ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
                    {historyError}
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-8 text-center dark:border-slate-800 dark:bg-slate-950/40">
                    <History className="mx-auto h-7 w-7 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No sign-ins recorded yet</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">History starts after this feature is enabled.</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {currentLogin && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">This session</h3>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-500/5">
                          <SignInRow entry={currentLogin} />
                        </div>
                      </div>
                    )}
                    {previousLogins.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Previous sign-ins</h3>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{previousLogins.length} shown in history</span>
                        </div>
                        <div id="previous-sign-ins" className={`rounded-xl border border-gray-200 dark:border-slate-700 ${showAllHistory ? "max-h-64 overflow-y-auto" : ""}`}>
                          <ol className="divide-y divide-gray-200 dark:divide-slate-800">
                            {visiblePreviousLogins.map((entry) => (
                              <li key={entry.login_id}><SignInRow entry={entry} /></li>
                            ))}
                          </ol>
                        </div>
                        {previousLogins.length > 2 && (
                          <button
                            type="button"
                            aria-expanded={showAllHistory}
                            aria-controls="previous-sign-ins"
                            onClick={() => setShowAllHistory((visible) => !visible)}
                            className="mt-2 min-h-10 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
                          >
                            {showAllHistory ? "Show fewer" : `Show all ${previousLogins.length} sign-ins`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Only the current session is active. If a sign-in looks unfamiliar, change your password in Security.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
