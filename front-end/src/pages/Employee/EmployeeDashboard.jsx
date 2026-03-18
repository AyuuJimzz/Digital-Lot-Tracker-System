import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

function EmployeeDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  // NEW: Track if the auth check is finished
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Fetch employees
  const fetchEmployees = useCallback(() => {
    setLoading(true);
    axios
      .get("http://localhost:5000/api/employees", {
        withCredentials: true,
      })
      .then((response) => {
        setEmployees(
          Array.isArray(response.data)
            ? response.data
            : response.data.employees || [],
        );
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 403) window.location.href = "/forbidden";
        else if (err.response?.status === 401)
          window.location.href = "/access-denied";
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  // Check session
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/auth/check-session", {
        withCredentials: true,
      })
      .then((response) => {
        if (
          response.data.role !== "employee" &&
          response.data.role !== "admin"
        ) {
          window.location.href = "/forbidden";
        } else {
          setIsAuthorized(true);
          fetchEmployees();
        }
      })
      .catch(() => {
        window.location.href = "/access-denied";
      });
  }, [fetchEmployees]);

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/auth/logout",
        {},
        {
          withCredentials: true,
        },
      );
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  const handleAddEmployee = async () => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/employees",
        {
          first_name: "New",
          last_name: "Employee",
          email: `new${Date.now()}@example.com`,
          password: "123456",
        },
        {
          withCredentials: true,
        },
      );

      if (response.status === 200) fetchEmployees();
    } catch (err) {
      if (err.response?.status === 403) window.location.href = "/forbidden";
      else console.error("Failed to add employee:", err);
    }
  };

  // NEW: Prevent the structure from rendering until authorized
  if (!isAuthorized) {
    return null; // Or a simple loading spinner
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Header */}
      <header className="bg-white flex justify-between items-center px-10 py-5 shadow-md">
        <h1 className="text-2xl font-bold text-blue-500">
          👤 Golden Dragon Estate - Employee
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-5 py-2 rounded-md text-sm transition-colors duration-300 hover:bg-red-700"
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto p-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-5 mb-10">
          <div className="bg-white p-8 rounded-lg text-center shadow-md transition-transform duration-200 hover:-translate-y-1">
            <h3 className="text-gray-600 text-sm font-normal mb-2">
              Total Employees
            </h3>
            <p className="text-blue-500 text-5xl font-bold">
              {loading ? "Loading..." : employees.length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-8 rounded-lg shadow-md flex flex-wrap gap-3">
          <button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">
            View Available Lots
          </button>
          <button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">
            Add Client
          </button>
          <button
            onClick={handleAddEmployee}
            className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105"
          >
            Add Employee (Test)
          </button>
          <button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">
            Record Sale
          </button>
          <button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">
            My Reports
          </button>
        </div>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
