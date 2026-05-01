import React, { useState, useEffect } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import RecentTransactions from "../../components/admin/AdminRecentTransactions";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const AdminDashboard = () => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [stats, setStats] = useState({
    totalLots: 0,
    soldLots: 0,
    availableLots: 0,
    pendingLots: 0,
    totalClients: 0,
  });

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/lots/dashboard-stats");

        console.log("Dashboard stats fetched:", response.data);

        setStats({
          totalLots: response.data.totalLots || 0,
          soldLots: response.data.soldLots || 0,
          availableLots: response.data.availableLots || 0,
          pendingLots: response.data.pendingLots || 0,
          totalClients: response.data.totalClients || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, []);

  const handlePasswordChanged = () => {
    localStorage.setItem("password_reset_required", "false");
    setShowPasswordChange(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Force Password Change Modal */}
      {showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Dashboard Overview
        </h1>
      </div>

      {/* Top Row Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Place Location" value="Iloilo City" />
        <StatCard title="Total Lots" value={String(stats.totalLots)} />
        <StatCard title="Lots Sold" value={String(stats.soldLots)} />
      </div>

      {/* Secondary Row Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Lots Available" value={String(stats.availableLots)} />
        <StatCard title="Lots Pending" value={String(stats.pendingLots)} />
        <StatCard title="Total Clients" value={String(stats.totalClients)} />
      </div>

      {/* Detailed Data Table */}
      <div className="pt-2">
        <RecentTransactions />
      </div>
    </div>
  );
};

export default AdminDashboard;
