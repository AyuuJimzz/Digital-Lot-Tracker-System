import React, { useEffect, useState } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import EmployeeTransactions from "../../components/employee/EmployeeRecentTransactions";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const EmployeeDashboard = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [stats, setStats] = useState({
    totalLots: 0,
    soldLots: 0,
    availableLots: 0,
    teamMembers: 0,
    totalCustomer: 0,
  });
  const [recentLotUpdates, setRecentLotUpdates] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const sessionResponse = await axios.get("http://localhost:5000/api/auth/check-session", {
          withCredentials: true,
        });

        if (sessionResponse.data.role !== "employee" && sessionResponse.data.role !== "admin") {
          window.location.href = "/forbidden";
          return;
        }

        setIsAuthorized(true);

        const [mapDataResponse, employeesResponse, customersResponse] = await Promise.all([
          axios.get("http://localhost:5000/api/lots/map-data", { withCredentials: true }),
          axios.get("http://localhost:5000/api/employees", { withCredentials: true }),
          axios.get("http://localhost:5000/api/customers", { withCredentials: true }),
        ]);

        const summary = mapDataResponse?.data?.summary || {};
        const lots = Array.isArray(mapDataResponse?.data?.lots) ? mapDataResponse.data.lots : [];
        const employees = Array.isArray(employeesResponse?.data) ? employeesResponse.data : [];
        const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];

        setStats({
          totalLots: summary.totalLots || 0,
          soldLots: summary.soldLots || 0,
          availableLots: summary.availableLots || 0,
          teamMembers: employees.length || 0,
          totalCustomer: customers.length || 0,
        });

        const updates = lots
          .slice()
          .sort((a, b) => Number(b.lot_id || 0) - Number(a.lot_id || 0))
          .slice(0, 5)
          .map((lot) => ({
            id: lot.lot_id,
            lotNumber: lot.lot_number,
            propertyId: lot.property_id,
            status: lot.status || "Unknown",
            area: lot.area_sqm,
          }));

        setRecentLotUpdates(updates);
      } catch (dashboardError) {
        if (dashboardError?.response?.status === 401) {
          window.location.href = "/access-denied";
          return;
        }
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

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      {showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Employee Dashboard</h1>
        <p className="text-sm text-gray-500 mt-2">Overview of lots and team activity.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Lots" value={String(stats.totalLots)} />
        <StatCard title="Lots Sold" value={String(stats.soldLots)} />
        <StatCard title="Lots Available" value={String(stats.availableLots)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Employee Team" value={String(stats.teamMembers)} />
        <StatCard title="Total Customers" value={String(stats.totalCustomer)} />
      </div>

      <div className="pt-2">
        <EmployeeTransactions loading={loading} error={error} items={recentLotUpdates} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
