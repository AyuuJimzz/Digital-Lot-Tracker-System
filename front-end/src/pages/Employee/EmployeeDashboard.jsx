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
  const [recentLotUpdates, setRecentLotUpdates] = useState(() => {
    try {
      const cached = sessionStorage.getItem("employeeRecentCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
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
        const lots = Array.isArray(mapDataResponse?.data?.lots) ? mapDataResponse.data.lots : [];
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

        const propertiesList = Array.isArray(mapDataResponse?.data?.properties)
          ? mapDataResponse.data.properties
          : [];
        const propNameMap = new Map();
        propertiesList.forEach((p) => {
          propNameMap.set(Number(p.property_id), p.property_name || `Property ${p.property_id}`);
        });

        // Build customer lookup map for quick access by lot_id
        const custMap = new Map();
        customers.forEach((c) => {
          if (c.lot_id) {
            custMap.set(Number(c.lot_id), c);
          }
        });

        // Build employee name lookup map by employee_id
        const empNameMap = new Map();
        employees.forEach((e) => {
          empNameMap.set(Number(e.employee_id), `${e.first_name || ""} ${e.last_name || ""}`.trim());
        });

        // Recent Lot Updates: Include Sold, Pending, and Cancelled lot interactions
        const processedCustLotKeys = new Set();
        const updates = [];

        customers.forEach((c) => {
          if (!c.lot_number) return;
          const rawStatus = String(c.lot_status || "").toLowerCase();
          const normalizedStatus =
            rawStatus === "available" || rawStatus === "cancelled"
              ? "Cancelled"
              : rawStatus === "sold"
              ? "Sold"
              : "Pending";
          const agentId = c?.employee_id ? Number(c.employee_id) : null;
          processedCustLotKeys.add(Number(c.lot_id));

          updates.push({
            id: c.customer_id,
            lotNumber: c.lot_number,
            propertyId: c.property_id,
            propertyName: c.property_name || propNameMap.get(Number(c.property_id)) || `Property ${c.property_id}`,
            status: normalizedStatus,
            area: c.area_sqm || "—",
            clientName: c.full_name || "—",
            clientContact: c.contact_number || "",
            clientEmail: c.email || "",
            agentName: agentId ? (empNameMap.get(agentId) || "—") : "Admin",
          });
        });

        // Add any lots that are Sold or Pending but don't have customer records
        lots.forEach((lot) => {
          if (["Sold", "Pending"].includes(lot.status) && !processedCustLotKeys.has(Number(lot.lot_id))) {
            updates.push({
              id: lot.lot_id,
              lotNumber: lot.lot_number,
              propertyId: lot.property_id,
              propertyName: propNameMap.get(Number(lot.property_id)) || `Property ${lot.property_id}`,
              status: lot.status,
              area: lot.area_sqm || "—",
              clientName: "—",
              clientContact: "",
              clientEmail: "",
              agentName: "Admin",
            });
          }
        });

        setRecentLotUpdates(updates);
        try {
          sessionStorage.setItem("employeeRecentCache", JSON.stringify(updates));
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
        <EmployeeTransactions loading={loading} error={error} items={recentLotUpdates} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
