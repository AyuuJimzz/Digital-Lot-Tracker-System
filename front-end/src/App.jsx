import React, { useState, useEffect } from "react";
import DesktopOnlyGuard from "./components/DesktopOnlyGuard";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts & Components
import { AdminLayout } from "./components/admin/AdminLayout";
import { EmployeeLayout } from "./components/employee/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import axios from "axios";
import { startKeepAlive, stopKeepAlive } from "./utils/keepAlive";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import ConcurrentSessionModal from "./components/ConcurrentSessionModal";
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

const queryClient = new QueryClient();

function App() {
  const [, setRole] = useState(localStorage.getItem("role") || null);

  // ── Real-Time Concurrent Session Heartbeat (detects other device logins within seconds) ──
  useEffect(() => {
    const verifySession = async () => {
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

    // Run check every 4 seconds and whenever user switches back to this browser window
    const interval = setInterval(verifySession, 4000);
    window.addEventListener("focus", verifySession);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", verifySession);
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
      <DesktopOnlyGuard>
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
                <Route path="/" element={<Login setRole={setRole} />} />
                <Route path="/login" element={<Login setRole={setRole} />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/forbidden" element={<Forbidden />} />

                <Route
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminLayout />
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
                      <EmployeeLayout />
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

                <Route path="/dev-panel" element={<DeveloperPanel />} />
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </React.Suspense>
          </Router>
        </QueryClientProvider>
      </DesktopOnlyGuard>

      {/* Automated 1-Click Install App Banner — outside guard so it shows on tablet too */}
      <PWAInstallPrompt />

      {/* Concurrent Device Session Kickout Alert Modal */}
      <ConcurrentSessionModal />
    </>
  );
}

export default App;
