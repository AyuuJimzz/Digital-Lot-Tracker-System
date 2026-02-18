import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";
import AccessDenied from "./view/AccessDenied";

function App() {
  const [role, setRole] = useState(localStorage.getItem("role"));

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole !== role) setRole(storedRole);
  }, [role]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setRole={setRole} />} />

        <Route
          path="/admin-panel"
          element={role === "admin" ? <AdminDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/employee-panel"
          element={
            role === "employee" ? <EmployeeDashboard /> : <Navigate to="/" />
          }
        />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
