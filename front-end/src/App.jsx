import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts & Components
import { AdminLayout } from "./components/admin/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";
import ManageEmployees from "./pages/Admin/ManageEmployees";
import AccessDenied from "./view/AccessDenied";
import Forbidden from "./view/forbidden";

const queryClient = new QueryClient();

function App() {
  const [, setRole] = useState(localStorage.getItem("role") || null);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Removed TooltipProvider, Toaster, and Sonner */}
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login setRole={setRole} />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="/forbidden" element={<Forbidden />} />

          {/* Admin Routes wrapped in AdminLayout */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin-panel" element={<AdminDashboard />} />
            <Route path="/manage-employees" element={<ManageEmployees />} />
          </Route>

          {/* Employee & Admin Routes */}
          <Route
            path="/employee-panel"
            element={
              <ProtectedRoute allowedRoles={["employee", "admin"]}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
