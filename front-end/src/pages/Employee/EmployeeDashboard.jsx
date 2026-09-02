import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import EmployeeTransactions from "../../components/employee/EmployeeRecentTransactions";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const EmployeeDashboard = () => {
  const [error, setError] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [stats, setStats] = useState(() => {
    try {
      const cached = sessionStorage.getItem("employeeStatsCache");
      return cached
        ? JSON.parse(cached)
        : {
            totalLots: 0,
            soldLots: 0,
            availableLots: 0,
            pendingLots: 0,
            teamMembers: 0,
            totalCustomer: 0,
          };
    } catch {
      return {
        totalLots: 0,
        soldLots: 0,
        availableLots: 0,
        pendingLots: 0,
        teamMembers: 0,
        totalCustomer: 0,
      };
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("employeeStatsCache"));

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setError("");
        const token = localStorage.getItem("authToken");
        const authConfig = {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        };

        const [mapDataResponse, employeesResponse, customersResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, authConfig),
          axios.get(`${API_BASE_URL}/api/employees`, authConfig).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/customers/all-for-map`, authConfig).catch(() => ({ data: [] })),
        ]);

        const summary = mapDataResponse?.data?.summary || {};
        const employees = Array.isArray(employeesResponse?.data) ? employeesResponse.data : [];
        const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];

        // Group customers by email to count unique emails only
        const uniqueCustomersByEmail = new Map();
        customers.forEach((customer) => {
          if (!uniqueCustomersByEmail.has(customer.email)) {
            uniqueCustomersByEmail.set(customer.email, customer);
          }
        });

        const newStats = {
          totalLots: summary.totalLots || 0,
          soldLots: summary.soldLots || 0,
          availableLots: summary.availableLots || 0,
          pendingLots: summary.pendingLots || 0,
          teamMembers: employees.length || 0,
          totalCustomer: uniqueCustomersByEmail.size || 0,
        };

        setStats(newStats);
        try {
          sessionStorage.setItem("employeeStatsCache", JSON.stringify(newStats));
        } catch (e) {}
      } catch (dashboardError) {
        setError("Unable to load employee dashboard data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const passwordResetRequired = localStorage.getItem("password_reset_required");
    if (
      passwordResetRequired === "true" ||
      passwordResetRequired === "1" ||
      passwordResetRequired === 1
    ) {
      setShowPasswordChange(true);
    }
  }, []);

  const handlePasswordChanged = () => {
    localStorage.setItem("password_reset_required", "false");
    setShowPasswordChange(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Employee Dashboard</h1>
          <p className="text-sm text-gray-500 mt-2">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Employee Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
          Overview of lots and team activity.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stat Cards — 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Lots" value={String(stats.totalLots)} />
        <StatCard title="Lots Sold" value={String(stats.soldLots)} />
        <StatCard title="Lots Available" value={String(stats.availableLots)} />
        <StatCard title="Lots Pending" value={String(stats.pendingLots)} />
        <StatCard title="Employee Team" value={String(stats.teamMembers)} />
        <StatCard title="Total Clients" value={String(stats.totalCustomer)} />
      </div>

      <div className="pt-2">
        <EmployeeTransactions />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
