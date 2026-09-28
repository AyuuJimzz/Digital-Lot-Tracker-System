import React, { useState, useEffect } from "react";
import DesktopOnlyGuard from "./components/DesktopOnlyGuard";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./config/queryClient";

// Layouts & Components
import { AdminLayout } from "./components/admin/AdminLayout";
import { EmployeeLayout } from "./components/employee/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import axios from "axios";
import { startKeepAlive, stopKeepAlive } from "./utils/keepAlive";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import ConcurrentSessionModal from "./components/ConcurrentSessionModal";
import GlobalToast from "./components/GlobalToast";
import { API_BASE_URL } from "./config/api";

// Pages (Code-split with React.lazy for maximum performance & bundle optimization)
const Login = React.lazy(() => import("./pages/Login"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const AdminDashboard = React.lazy(() => import("./pages/Admin/AdminDashboard"));
const EmployeeDashboard = React.lazy(() => import("./pages/Employee/EmployeeDashboard"));
const EmployeeMapView = React.lazy(() => import("./pages/Employee/EmployeeMapView"));
const MyProperties = React.lazy(() => import("./pages/Employee/MyProperties"));
const MySales = React.lazy(() => import("./pages/Employee/MySales"));
const Customers = React.lazy(() => import("./pages/Employee/Customers"));
const ManageEmployees = React.lazy(() => import("./pages/Admin/ManageEmployees"));
const ManageProperties = React.lazy(() => import("./pages/Admin/ManageProperties"));
const AccessDenied = React.lazy(() => import("./view/AccessDenied"));
const EstateMap = React.lazy(() => import("./pages/Admin/AdminViewMap"));
const Forbidden = React.lazy(() => import("./view/forbidden"));
const ProfileSettings = React.lazy(() => import("./pages/Shared/ProfileSettings"));
const DeveloperPanel = React.lazy(() => import("./pages/Developer/DeveloperPanel"));
const MaintenancePage = React.lazy(() => import("./pages/MaintenancePage"));

function App() {
  const [, setRole] = useState(localStorage.getItem("role") || null);

  // ── Real-Time Concurrent Session Heartbeat (throttled to 15s to protect Render 0.1 vCPU & DB connections) ──
  useEffect(() => {
    const verifySession = async () => {
      // Skip background timer ticks if tab/tablet screen is sleeping/minimized
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const activeToken = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!activeToken) return;

      try {
        await axios.get(`${API_BASE_URL}/api/auth/check-session`, {
          headers: { Authorization: `Bearer ${activeToken}` },
          withCredentials: true,
        });
      } catch (err) {
        // Global axios interceptor in api.js automatically dispatches concurrentSessionKickedOut
      }
    };

    // Run check every 15 seconds and immediately whenever user switches back/unlocks device
    const interval = setInterval(verifySession, 15000);
    const handleVisibilityOrFocus = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        verifySession();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  // ── Keep Render.com backend awake — prevents 30-60s cold start delays ──
  useEffect(() => {
    startKeepAlive();
    return () => stopKeepAlive();
  }, []);

  // ── Maintenance Mode Interceptor ──
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response &&
          error.response.status === 503 &&
          error.response.data &&
          error.response.data.maintenance
        ) {
          if (
            window.location.pathname !== "/maintenance" &&
            window.location.pathname !== "/dev-panel"
          ) {
            window.location.href = "/maintenance";
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // ── Keyboard Shortcut for Developer Panel (Ctrl + Shift + D) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        window.location.href = "/dev-panel";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <Router>
          <React.Suspense
            fallback={
              <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-slate-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={<DesktopOnlyGuard><Login setRole={setRole} /></DesktopOnlyGuard>}
              />
              <Route
                path="/login"
                element={<DesktopOnlyGuard><Login setRole={setRole} /></DesktopOnlyGuard>}
              />
              <Route
                path="/forgot-password"
                element={<DesktopOnlyGuard><ForgotPassword /></DesktopOnlyGuard>}
              />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/forbidden" element={<Forbidden />} />

              <Route
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <DesktopOnlyGuard>
                      <AdminLayout />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="/admin-panel" element={<AdminDashboard />} />
                <Route path="/manage-employees" element={<ManageEmployees />} />
                <Route path="/manage-properties" element={<ManageProperties />} />
                <Route path="/manage-lots" element={<EstateMap />} />
                <Route path="/settings" element={<ProfileSettings />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={["employee", "admin"]}>
                    <DesktopOnlyGuard>
                      <EmployeeLayout />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="/employee-panel" element={<EmployeeDashboard />} />
                <Route path="/employee/my-properties" element={<MyProperties />} />
                <Route path="/employee/my-sales" element={<MySales />} />
                <Route path="/employee/my-clients" element={<Customers />} />
                <Route path="/employee/map-view" element={<EmployeeMapView />} />
                <Route path="/employee/settings" element={<ProfileSettings />} />
              </Route>

              <Route
                path="/dev-panel"
                element={
                  <DesktopOnlyGuard>
                    <DeveloperPanel />
                  </DesktopOnlyGuard>
                }
              />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </React.Suspense>
        </Router>
      </QueryClientProvider>

      {/* Automated 1-Click Install App Banner — outside guard so it shows on tablet too */}
      <PWAInstallPrompt />

      {/* Concurrent Device Session Kickout Alert Modal */}
      <ConcurrentSessionModal />

      {/* Global Luxury Toast Notification System & Native Alert Interceptor */}
      <GlobalToast />
    </>
  );
}

export default App;
