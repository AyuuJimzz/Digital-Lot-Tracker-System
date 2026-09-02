import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import {
  User,
  Shield,
  CheckCircle,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

const ProfileSettings = () => {
  const location = useLocation();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";
  const [activeTab, setActiveTab] = useState(location.state?.tab || "profile");
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
  });
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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Restore JWT token for cross-origin deployments (Vercel + Render)
        const savedToken = localStorage.getItem("authToken");
        if (savedToken) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        }
        const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
          withCredentials: true,
        });
        setProfileData({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          email: res.data.email || "",
          phone_number: isAdmin ? "" : res.data.phone_number || "",
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        setMessage({ type: "error", text: "Failed to load profile details." });
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAdmin]);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/auth/profile`, profileData, {
        withCredentials: true,
      });
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Error updating profile." });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      await axios.put(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        },
        { withCredentials: true }
      );
      setMessage({ type: "success", text: "Password changed successfully!" });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Error changing password.",
      });
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
  ];

  const inputClass =
    "w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage your profile and account preferences
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Left Sidebar */}
          <div className="sm:w-64 shrink-0 space-y-3">
            {/* Avatar Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
                <span className="text-2xl font-extrabold text-white tracking-widest">
                  {getInitials(profileData.first_name, profileData.last_name)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {profileData.first_name || profileData.last_name
                    ? `${profileData.first_name} ${profileData.last_name}`.trim()
                    : "Your Name"}
                </p>
                <p
                  className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate w-full px-2"
                  title={profileData.email}
                >
                  {profileData.email || "No email"}
                </p>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMessage({ type: "", text: "" });
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500"
                        : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0">
            {/* Alert */}
            {message.text && (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm border ${
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
              <form
                onSubmit={saveProfile}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                    Personal Information
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Update your name and email details
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-first-name" className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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
                      <label htmlFor="settings-last-name" className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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

                  {/* Email */}
                  <div>
                    <label htmlFor="settings-email" className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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

                {/* Card Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm shadow-amber-200 dark:shadow-amber-900/40"
                  >
                    {saving && (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <form
                onSubmit={savePassword}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                    Change Password
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Use a strong password to keep your account secure
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {[
                    { label: "Current Password", name: "currentPassword", show: "current", auto: "current-password" },
                    { label: "New Password", name: "newPassword", show: "new", auto: "new-password" },
                    { label: "Confirm New Password", name: "confirmPassword", show: "confirm", auto: "new-password" },
                  ].map(({ label, name, show, auto }) => (
                    <div key={name}>
                      <label htmlFor={`settings-${name}`} className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, [show]: !showPasswords[show] })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
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

                {/* Card Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm shadow-amber-200 dark:shadow-amber-900/40"
                  >
                    {saving && (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
