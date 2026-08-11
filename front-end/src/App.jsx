import React, { useState } from "react";
import DesktopOnlyGuard from "./components/DesktopOnlyGuard";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts & Components
import { AdminLayout } from "./components/admin/AdminLayout";
import { EmployeeLayout } from "./components/employee/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";
import EmployeeMapView from "./pages/Employee/EmployeeMapView";
import MyProperties from "./pages/Employee/MyProperties";
import MySales from "./pages/Employee/MySales";
import Customers from "./pages/Employee/Customers";
import ManageEmployees from "./pages/Admin/ManageEmployees";
import ManageProperties from "./pages/Admin/ManageProperties";
import AccessDenied from "./view/AccessDenied";
import EstateMap from "./pages/Admin/AdminViewMap";
import Forbidden from "./view/forbidden";
import ProfileSettings from "./pages/Shared/ProfileSettings";

const queryClient = new QueryClient();


function App() {
  const [, setRole] = useState(localStorage.getItem("role") || null);

  return (
    <DesktopOnlyGuard>
      <QueryClientProvider client={queryClient}>
        <Router>
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

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </DesktopOnlyGuard>
  );
}

export default App;
