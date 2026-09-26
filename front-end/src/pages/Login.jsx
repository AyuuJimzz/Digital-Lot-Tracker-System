import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import logo from "../assets/image/golden-dragon-logo.png";
import { API_BASE_URL } from "../config/api";
import { clearStoredAuth, clearUserDataCache, getStoredToken } from "../utils/authStorage";

function Login({ setRole }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const loginStartedRef = useRef(false);

  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const nextClicks = prev + 1;
      if (nextClicks >= 5) {
        navigate("/dev-panel");
        return 0;
      }
      return nextClicks;
    });
  };

  // Reset logo clicks after 3 seconds of no clicks
  useEffect(() => {
    if (logoClicks > 0) {
      const timer = setTimeout(() => setLogoClicks(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [logoClicks]);

  useEffect(() => {
    let cancelled = false;
    const savedToken = getStoredToken();
    if (savedToken) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    }
    axios
      .get(`${API_BASE_URL}/api/auth/check-session`, {
        headers: { Authorization: savedToken ? `Bearer ${savedToken}` : null },
        withCredentials: true,
        timeout: 15000,
      })
      .then((response) => {
        if (cancelled || loginStartedRef.current || getStoredToken() !== savedToken) return;
        if (response.data.authenticated && response.data.role) {
          localStorage.setItem("role", response.data.role || "");
          localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
          setRole(response.data.role || null);
          if (response.data.role === "admin") navigate("/admin-panel");
          else if (response.data.role === "employee") navigate("/employee-panel");
        } else {
          clearStoredAuth(savedToken);
        }
      })
      .catch((err) => {
        if (cancelled || loginStartedRef.current || getStoredToken() !== savedToken) return;
        if (err.response?.status === 401 || err.response?.status === 403) {
          clearStoredAuth(savedToken);
        } else if (savedToken) {
          // Only show error if the user had a previous session they were trying to resume
          setError("Unable to restore previous session due to slow connection. Please sign in again.");
        }
      });
    return () => { cancelled = true; };
  }, [navigate, setRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    loginStartedRef.current = true;
    setError("");
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
        { headers: { Authorization: null }, withCredentials: true, timeout: 25000 }
      );
      const userRole = response.data.user.role;
      const passwordResetRequired = response.data.password_reset_required;
      clearUserDataCache();
      // Save JWT token for cross-origin deployments (Vercel + Render)
      if (response.data.token) {
        localStorage.setItem("authToken", response.data.token);
        localStorage.removeItem("token");
        axios.defaults.headers.common["Authorization"] = `Bearer ${response.data.token}`;
      }
      localStorage.setItem("role", userRole);
      if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      localStorage.setItem("password_reset_required", passwordResetRequired ? "true" : "false");
      setRole(userRole);
      if (userRole === "admin") navigate("/admin-panel");
      else if (userRole === "employee") navigate("/employee-panel");
    } catch (err) {
      if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
        setError("The server took too long to respond (connection timed out). It may be waking up or your internet is slow. Please try again.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("Unable to connect to the server. Please check your internet connection.");
      } else if (err.response?.status === 401 || err.response?.status === 400) {
        setError(err.response?.data?.message || "Invalid email or password. Please try again.");
      } else if (err.response?.status === 429) {
        setError(err.response?.data?.message || "Too many login attempts. Please wait a moment and try again.");
      } else if (err.response?.status >= 500) {
        setError("The server is temporarily unavailable. Please try again in a few moments.");
      } else {
        setError(err.response?.data?.message || "Login failed. Please check your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex bg-white" role="main">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center px-16 bg-white">

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div>
            <img
              src={logo}
              alt="Golden Dragon Logo"
              width="160"
              height="160"
              loading="eager"
              onClick={handleLogoClick}
              className="w-40 h-40 object-contain drop-shadow-md cursor-pointer"
            />
          </div>

          <div>
            <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-tight">
              Golden <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Dragon</span>
            </h1>
            <p className="text-lg text-gray-700 font-medium mt-2 tracking-[0.2em] uppercase">
              Estate Corporation
            </p>
          </div>

        </div>
      </div>

      {/* ── Divider ── */}
      <div className="hidden lg:block w-px bg-gray-200 self-stretch" />

      {/* ── Right Panel (Login Form) ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16 bg-gray-100">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center mb-10 gap-3">
            <img 
              src={logo} 
              alt="Golden Dragon Logo" 
              width="80"
              height="80"
              loading="eager"
              onClick={handleLogoClick}
              className="w-20 h-20 object-contain cursor-pointer" 
            />
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-900">Golden Dragon</h1>
              <p className="text-amber-600 font-medium text-sm tracking-wider uppercase">Estate Corporation</p>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-600 mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-amber-600 transition-colors" />
                <input
                  id="login-email"
                  name="email"
                  autoComplete="username email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 hover:border-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-gray-900 placeholder-gray-500 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-amber-600 transition-colors" />
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 hover:border-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-gray-900 placeholder-gray-500 rounded-xl pl-11 pr-12 py-3.5 text-sm outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-amber-600 p-2 rounded-lg transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-xs text-amber-700 hover:text-amber-800 font-medium py-2 px-1 transition-colors"
              >
                Forgot your password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3.5 transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Login;
