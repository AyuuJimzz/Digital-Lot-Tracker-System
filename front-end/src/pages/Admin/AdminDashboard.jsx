import React, { useState, useEffect } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import RecentTransactions from "../../components/admin/AdminRecentTransactions";
import MonthlyRecapReport from "../../components/admin/MonthlyRecapReport";
import LotsSoldProperties from "../../components/admin/LotsSoldProperties";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const AdminDashboard = () => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("Month");
  const [stats, setStats] = useState({
    totalLots: 0,
    soldLots: 0,
    availableLots: 0,
    pendingLots: 0,
    totalClients: 0,
  });
  const [propertiesData, setPropertiesData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  const periods = ["Today", "Week", "Month", "This Year"];

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

  useEffect(() => {
    const fetchPropertyStats = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/lots/time-based-sales", {
          params: { period: selectedPeriod.toLowerCase() },
        });

        console.log("Time-based property stats fetched:", response.data);
        setPropertiesData(response.data);
      } catch (error) {
        console.error("Error fetching time-based property stats:", error);
      }
    };

    fetchPropertyStats();
  }, [selectedPeriod]);

  useEffect(() => {
    const fetchMonthlySalesData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/lots/monthly-sales");

        console.log("Monthly sales data fetched:", response.data);
        setMonthlyData(response.data);
      } catch (error) {
        console.error("Error fetching monthly sales data:", error);
      }
    };

    fetchMonthlySalesData();
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

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-7">
          <MonthlyRecapReport data={monthlyData} />
        </div>
        <div className="lg:col-span-3">
          <LotsSoldProperties
            properties={propertiesData}
            selectedMonth={selectedPeriod}
            months={periods}
            onMonthChange={(e) => setSelectedPeriod(e.target.value)}
          />
        </div>
      </div>

      {/* Detailed Data Table */}
      <div className="pt-2">
        <RecentTransactions />
      </div>
    </div>
  );
};

export default AdminDashboard;
