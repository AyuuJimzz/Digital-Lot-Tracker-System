import React, { useState, useEffect } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import RecentTransactions from "../../components/admin/AdminRecentTransactions";
import MonthlyRecapReport from "../../components/admin/MonthlyRecapReport";
import LotsSoldProperties from "../../components/admin/LotsSoldProperties";
import ForcePasswordChange from "../../components/ForcePasswordChange";
import ProjectDashboardSwitcher from "../../components/admin/ProjectDashboardSwitcher";
import { API_BASE_URL } from "../../config/api";
import { syncColorsFromDatabase, loadCustomColors } from "../../utils/subdivisionColors";

const AdminDashboard = () => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedProject, setSelectedProject] = useState("all");
  const [customColors, setCustomColors] = useState(() => loadCustomColors());
  const [statsLoading, setStatsLoading] = useState(false);

  const [stats, setStats] = useState(() => {
    try {
      const cached = sessionStorage.getItem("adminStatsCache");
      return cached ? JSON.parse(cached) : {
        totalLots: 0,
        soldLots: 0,
        availableLots: 0,
        pendingLots: 0,
        totalClients: 0,
        totalParcels: 0,
        nonSaleableLots: 0,
        placeLocation: "Iloilo City",
        propertyName: "All Projects (Whole Estate)",
        subdivisions: [],
      };
    } catch {
      return {
        totalLots: 0,
        soldLots: 0,
        availableLots: 0,
        pendingLots: 0,
        totalClients: 0,
        totalParcels: 0,
        nonSaleableLots: 0,
        placeLocation: "Iloilo City",
        propertyName: "All Projects (Whole Estate)",
        subdivisions: [],
      };
    }
  });

  const [subdivisionPeriod, setSubdivisionPeriod] = useState("all");
  const [propertiesResult, setPropertiesResult] = useState({ period: null, data: null, loading: true, error: false });
  const [monthlyResult, setMonthlyResult] = useState({ year: null, data: null, loading: true, error: false });
  const [availableYears, setAvailableYears] = useState([currentYear]);

  useEffect(() => {
    syncColorsFromDatabase();
    const handleColorUpdate = () => {
      setCustomColors(loadCustomColors());
    };
    window.addEventListener("gde-subdivision-color-changed", handleColorUpdate);
    window.addEventListener("storage", handleColorUpdate);

    const passwordResetRequired = localStorage.getItem("password_reset_required");
    if (
      passwordResetRequired === "true" ||
      passwordResetRequired === "1" ||
      passwordResetRequired === 1
    ) {
      setShowPasswordChange(true);
    }

    return () => {
      window.removeEventListener("gde-subdivision-color-changed", handleColorUpdate);
      window.removeEventListener("storage", handleColorUpdate);
    };
  }, []);

  // Fetch Dashboard Stats based on selected project
  useEffect(() => {
    let isCancelled = false;
    setStatsLoading(true);

    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
        const response = await axios.get(`${API_BASE_URL}/api/lots/dashboard-stats`, {
          ...authConfig,
          params: selectedProject && selectedProject !== "all" ? { property_id: selectedProject } : {},
        });

        if (!isCancelled) {
          const newStats = {
            totalLots: response.data.totalLots || 0,
            soldLots: response.data.soldLots || 0,
            availableLots: response.data.availableLots || 0,
            pendingLots: response.data.pendingLots || 0,
            totalClients: response.data.totalClients || 0,
            totalParcels: response.data.totalParcels || 0,
            nonSaleableLots: response.data.nonSaleableLots || 0,
            placeLocation: response.data.placeLocation || "Iloilo City",
            propertyName: response.data.propertyName || "All Projects (Whole Estate)",
            propertyId: response.data.propertyId || "all",
            subdivisions: Array.isArray(response.data.subdivisions) ? response.data.subdivisions : [],
          };

          setStats(newStats);
          if (selectedProject === "all") {
            try { sessionStorage.setItem("adminStatsCache", JSON.stringify(newStats)); } catch (e) {}
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching dashboard stats:", error);
        }
      } finally {
        if (!isCancelled) {
          setStatsLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isCancelled = true;
    };
  }, [selectedProject]);

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

  const estateTotalSaleable = stats.subdivisions?.length > 0
    ? stats.subdivisions.reduce((sum, s) => sum + (Number(s.totalLots) || 0), 0)
    : stats.totalLots;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Force Password Change Modal */}
      {showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

      {/* Project Dashboard Switcher Header */}
      <ProjectDashboardSwitcher
        subdivisions={stats.subdivisions || []}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        customColors={customColors}
        totalEstateLots={estateTotalSaleable}
      />

      {/* Stat Cards — 2 cols on tablet, 3 cols on desktop */}
      <div
        className={`grid grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-200 ${
          statsLoading ? "opacity-60 pointer-events-none" : "opacity-100"
        }`}
      >
        <StatCard
          title="Place Location"
          value={stats.placeLocation}
          subtitle={selectedProject === "all" ? "Whole Estate Portfolio" : stats.propertyName}
        />
        <StatCard
          title="Total Lots"
          value={String(stats.totalLots)}
          subtitle={stats.nonSaleableLots > 0 ? `Saleable (${stats.nonSaleableLots} non-saleable)` : "Saleable Inventory"}
        />
        <StatCard
          title="Lots Sold"
          value={String(stats.soldLots)}
          subtitle={stats.totalLots > 0 ? `${Math.round((stats.soldLots / stats.totalLots) * 100)}% of inventory sold` : "Sold Lots"}
        />
        <StatCard
          title="Lots Available"
          value={String(stats.availableLots)}
          subtitle="Ready for Acquisition"
        />
        <StatCard
          title="Lots Pending"
          value={String(stats.pendingLots)}
          subtitle="Active Reservations"
        />
        <StatCard
          title="Total Clients"
          value={String(stats.totalClients)}
          subtitle="Unique buyers & reservation holders"
        />
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
            activeSubdivision={selectedProject}
            onSubdivisionSelect={setSelectedProject}
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
            selectedPropertyId={selectedProject}
            onSelectProperty={setSelectedProject}
          />
        </div>
      </div>

      {/* Detailed Data Table */}
      <div className="pt-2">
        <RecentTransactions
          selectedPropertyId={selectedProject}
          onClearPropertyFilter={() => setSelectedProject("all")}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
