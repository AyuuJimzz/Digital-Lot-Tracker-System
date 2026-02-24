import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";
import ManageEmployees from "./pages/Admin/ManageEmployees";
import AccessDenied from "./view/AccessDenied";
import Forbidden from "./view/forbidden";

function App() {
  // Get role from localStorage
  const [role, setRole] = useState(localStorage.getItem("role") || null);

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login setRole={setRole} />} />

        {/* Admin Routes */}
        <Route
          path="/admin-panel"
          element={
            !role ? (
              <Navigate to="/access-denied" />
            ) : role !== "admin" ? (
              <Navigate to="/forbidden" />
            ) : (
              <AdminDashboard />
            )
          }
        />

        <Route
          path="/manage-employees"
          element={
            !role ? (
              <Navigate to="/access-denied" />
            ) : role !== "admin" ? (
              <Navigate to="/forbidden" />
            ) : (
              <ManageEmployees />
            )
          }
        />

        {/* Employee Routes */}
        <Route
          path="/employee-panel"
          element={
            !role ? (
              <Navigate to="/access-denied" />
            ) : role !== "employee" ? (
              <Navigate to="/forbidden" />
            ) : (
              <EmployeeDashboard />
            )
          }
        />

        {/* Error Pages */}
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/forbidden" element={<Forbidden />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
