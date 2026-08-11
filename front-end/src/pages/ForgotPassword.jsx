import { API_BASE_URL } from "../config/api";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, AlertCircle } from "lucide-react";
import logo from "../assets/image/golden-dragon-logo.png";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setEmail("");
      } else {
        setError(data.message || "Failed to send reset email");
      }
    } catch (err) {
      setError("Unable to connect to server");
      console.error("Forgot password error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center px-16 bg-white">
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <img
            src={logo}
            alt="Golden Dragon Logo"
            className="w-40 h-40 object-contain drop-shadow-md"
          />
          <div>
            <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-tight">
              Golden{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                Dragon
              </span>
            </h1>
            <p className="text-lg text-gray-500 font-light mt-2 tracking-[0.2em] uppercase">
              Estate Corporation
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-px bg-gray-200 self-stretch" />

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16 bg-gray-100">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden flex-col items-center mb-10 gap-3">
            <img src={logo} alt="Golden Dragon Logo" className="w-20 h-20 object-contain" />
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-900">Golden Dragon</h1>
              <p className="text-amber-500/80 text-sm tracking-wider uppercase">
                Estate Corporation
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Forgot password</h2>
            <p className="text-gray-500 mt-1.5 text-sm">
              Enter your account email and we will send a temporary password.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-white border border-gray-300 hover:border-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-gray-900 placeholder-gray-400 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3.5 transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send Temporary Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-xs text-amber-500/90 hover:text-amber-600 transition-colors"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
