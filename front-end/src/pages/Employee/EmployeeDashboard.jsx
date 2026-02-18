import React, { useEffect, useState } from "react";
import "./EmployeeDashboard.css";

function EmployeeDashboard() {
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    fetch("http://localhost:5000/api/auth/check-session", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then((data) => {
        if (data.role !== "employee") {
          alert("Access denied. Please log in as an employee.");
          window.location.href = "/";
        }
      })
      .catch(() => {
        alert("Please log in first");
        window.location.href = "/";
      });
  }, []);

  // Fetch employees data (protected route)
  useEffect(() => {
    fetch("http://localhost:5000/api/employees", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch employees");
        return res.json();
      })
      .then((data) => setEmployees(data))
      .catch((err) => console.error(err));
  }, []);

  const handleLogout = async () => {
    await fetch("http://localhost:5000/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
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
            <p>{employees.length}</p>
          </div>
        </div>

        <div className="actions">
          <button>View Available Lots</button>
          <button>Add Client</button>
          <button>Record Sale</button>
          <button>My Reports</button>
        </div>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
