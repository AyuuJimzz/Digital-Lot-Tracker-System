import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

function ForcePasswordChange({ onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/reset-password`,
        { newPassword, confirmPassword },
        { withCredentials: true, headers }
      );

      if (response.data && response.status === 200) {
        localStorage.setItem("password_reset_required", "false");
        if (onPasswordChanged) {
          onPasswordChanged();
        }
      } else {
        setError(response.data?.message || "Failed to reset password");
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Unable to connect to server";
      setError(errMsg);
      console.error("Reset password error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-7 sm:p-8 text-slate-900">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 shadow-inner">
            <Lock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Password Reset Required
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please create a new permanent password to continue.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label htmlFor="force-new-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                id="force-new-password"
                name="new-password"
                autoComplete="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password (min. 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-slate-900 placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 pr-11 text-sm outline-none transition-all"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="force-confirm-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="force-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-slate-900 placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 pr-11 text-sm outline-none transition-all"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
              </button>
            </div>
            {passwordsMatch && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match perfectly!
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-sm rounded-xl py-3 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating Password...
              </>
            ) : (
              "Set New Password"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-400 font-medium">
          🔒 You cannot proceed to dashboard without changing your temporary password.
        </p>
      </div>
    </div>
  );
}

export default ForcePasswordChange;
