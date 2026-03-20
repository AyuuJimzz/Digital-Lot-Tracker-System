import React, { useState } from "react";
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
import ManageEmployees from "./pages/Admin/ManageEmployees";
import ManageProperties from "./pages/Admin/ManageProperties";
import AccessDenied from "./view/AccessDenied";
import EstateMap from "./pages/Admin/LotsMap";
import Forbidden from "./view/forbidden";

const queryClient = new QueryClient();

function EmployeePlaceholder({ title }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
      <p className="text-sm text-gray-500 mt-2">This page is under development.</p>
    </div>
  );
}

function App() {
	const [, setRole] = useState(localStorage.getItem("role") || null);

  return (
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
            <Route path="/analytics" element={<EmployeePlaceholder title="Analytics" />} />
            <Route path="/settings" element={<EmployeePlaceholder title="Settings" />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["employee", "admin"]}>
                <EmployeeLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/employee-panel" element={<EmployeeDashboard />} />
            <Route path="/employee/my-properties" element={<EmployeePlaceholder title="My Properties" />} />
            <Route path="/employee/my-sales" element={<EmployeePlaceholder title="My Sales" />} />
            <Route path="/employee/analytics" element={<EmployeePlaceholder title="Analytics" />} />
            <Route path="/employee/settings" element={<EmployeePlaceholder title="Settings" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
