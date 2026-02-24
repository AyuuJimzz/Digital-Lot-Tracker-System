import React, { useEffect, useState, useCallback } from "react";
import "./EmployeeDashboard.css";

function EmployeeDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch employees
  const fetchEmployees = useCallback(() => {
    setLoading(true);
    fetch("http://localhost:5000/api/employees", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) {
            window.location.href = "/forbidden";
          } else if (res.status === 401) {
            window.location.href = "/access-denied";
          }
          const text = await res.text();
          throw new Error(text || "Failed to fetch employees");
        }
        return res.json();
      })
      .then((data) => {
        setEmployees(Array.isArray(data) ? data : data.employees || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  // Check session
  useEffect(() => {
    fetch("http://localhost:5000/api/auth/check-session", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          window.location.href = "/access-denied";
          throw new Error("Not logged in");
        }
        return res.json();
      })
      .then((data) => {
        if (data.role !== "employee" && data.role !== "admin") {
          window.location.href = "/forbidden";
        } else {
          fetchEmployees();
        }
      })
      .catch(() => {
        window.location.href = "/access-denied";
      });
  }, [fetchEmployees]);

  const handleLogout = async () => {
    await fetch("http://localhost:5000/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  const handleAddEmployee = async () => {
    const response = await fetch("http://localhost:5000/api/employees", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "New",
        last_name: "Employee",
        email: `new${Date.now()}@example.com`,
        password: "123456",
      }),
    });

    if (response.ok) {
      fetchEmployees();
    } else if (response.status === 403) {
      window.location.href = "/forbidden";
    } else {
      console.error("Failed to add employee");
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>👤 Golden Dragon Estate - Employee</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <main>
        <div className="stats">
          <div className="card">
            <h3>Total Employees</h3>
            <p>{loading ? "Loading..." : employees.length}</p>
          </div>
        </div>

        <div className="actions">
          <button>View Available Lots</button>
          <button>Add Client</button>
          <button onClick={handleAddEmployee}>Add Employee (Test)</button>
          <button>Record Sale</button>
          <button>My Reports</button>
        </div>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
