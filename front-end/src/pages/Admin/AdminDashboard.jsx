import React, { useState, useEffect } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import RecentTransactions from "../../components/admin/AdminRecentTransactions";
import MonthlyRecapReport from "../../components/admin/MonthlyRecapReport";
import LotsSoldProperties from "../../components/admin/LotsSoldProperties";
import ForcePasswordChange from "../../components/ForcePasswordChange";
import { API_BASE_URL } from "../../config/api";

const AdminDashboard = () => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [stats, setStats] = useState(() => {
    try {
      const cached = sessionStorage.getItem("adminStatsCache");
      return cached ? JSON.parse(cached) : {
        totalLots: 0,
        soldLots: 0,
        availableLots: 0,
        pendingLots: 0,
        totalClients: 0,
      };
    } catch {
      return { totalLots: 0, soldLots: 0, availableLots: 0, pendingLots: 0, totalClients: 0 };
    }
  });
  const [subdivisionPeriod, setSubdivisionPeriod] = useState("all");
  const [propertiesResult, setPropertiesResult] = useState({ period: null, data: null, loading: true, error: false });
  const [monthlyResult, setMonthlyResult] = useState({ year: null, data: null, loading: true, error: false });
  const [availableYears, setAvailableYears] = useState([currentYear]);

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
        const token = localStorage.getItem("authToken");
        const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
        const response = await axios.get(`${API_BASE_URL}/api/lots/dashboard-stats`, authConfig);

        const newStats = {
          totalLots: response.data.totalLots || 0,
          soldLots: response.data.soldLots || 0,
          availableLots: response.data.availableLots || 0,
          pendingLots: response.data.pendingLots || 0,
          totalClients: response.data.totalClients || 0,
        };

        setStats(newStats);
        try { sessionStorage.setItem("adminStatsCache", JSON.stringify(newStats)); } catch (e) {}
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const activePeriod = subdivisionPeriod === "all" ? "all" : String(selectedYear);
    setPropertiesResult({ period: activePeriod, data: null, loading: true, error: false });
    const fetchPropertyStats = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };

        const response = await axios.get(`${API_BASE_URL}/api/lots/time-based-sales`, {
          ...authConfig,
          params: { period: activePeriod },
        });

        if (!isCancelled) {
          setPropertiesResult({ period: activePeriod, data: response.data, loading: false, error: false });
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching time-based property stats:", error);
          setPropertiesResult({ period: activePeriod, data: null, loading: false, error: true });
        }
      }
    };

    fetchPropertyStats();
    return () => {
      isCancelled = true;
    };
  }, [subdivisionPeriod, selectedYear]);

  useEffect(() => {
    let isCancelled = false;
    setMonthlyResult({ year: selectedYear, data: null, loading: true, error: false });
    const fetchMonthlySalesData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
        const response = await axios.get(`${API_BASE_URL}/api/lots/monthly-sales`, {
          ...authConfig,
          params: { year: selectedYear },
        });

        if (!isCancelled) {
          setMonthlyResult({ year: selectedYear, data: response.data, loading: false, error: false });
          if (Array.isArray(response.data?.availableYears)) {
            setAvailableYears(response.data.availableYears);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching monthly sales data:", error);
          setMonthlyResult({ year: selectedYear, data: null, loading: false, error: true });
        }
      }
    };

    fetchMonthlySalesData();
    return () => {
      isCancelled = true;
    };
  }, [selectedYear]);

  const activeSubdivisionPeriod = subdivisionPeriod === "all" ? "all" : String(selectedYear);
  const visibleMonthly = monthlyResult.year === selectedYear ? monthlyResult : null;
  const visibleProperties = propertiesResult.period === activeSubdivisionPeriod ? propertiesResult : null;

  const handlePasswordChanged = () => {
    localStorage.setItem("password_reset_required", "false");
    setShowPasswordChange(false);
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

      {/* Stat Cards — 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Place Location" value="Iloilo City" />
        <StatCard title="Total Lots" value={String(stats.totalLots)} />
        <StatCard title="Lots Sold" value={String(stats.soldLots)} />
        <StatCard title="Lots Available" value={String(stats.availableLots)} />
        <StatCard title="Lots Pending" value={String(stats.pendingLots)} />
        <StatCard title="Total Clients" value={String(stats.totalClients)} />
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-7 min-w-0">
          <MonthlyRecapReport
            data={visibleMonthly?.data}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={setSelectedYear}
            isLoading={!visibleMonthly || visibleMonthly.loading}
            hasError={Boolean(visibleMonthly?.error)}
          />
        </div>
        <div className="lg:col-span-3 min-w-0">
          <LotsSoldProperties
            properties={visibleProperties?.data}
            selectedYear={selectedYear}
            period={subdivisionPeriod}
            onPeriodChange={setSubdivisionPeriod}
            isLoading={!visibleProperties || visibleProperties.loading}
            hasError={Boolean(visibleProperties?.error)}
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
