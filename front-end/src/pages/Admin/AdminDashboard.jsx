import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import RecentTransactions from "../../components/admin/AdminRecentTransactions";
import MonthlyRecapReport from "../../components/admin/MonthlyRecapReport";
import LotsSoldProperties from "../../components/admin/LotsSoldProperties";
import ForcePasswordChange from "../../components/ForcePasswordChange";
import ProjectDashboardSwitcher from "../../components/admin/ProjectDashboardSwitcher";
import { API_BASE_URL } from "../../config/api";
import { queryClient } from "../../config/queryClient";
import { syncColorsFromDatabase, loadCustomColors } from "../../utils/subdivisionColors";

const AdminDashboard = () => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedProject, setSelectedProject] = useState("all");
  const [customColors, setCustomColors] = useState(() => loadCustomColors());
  const [statsLoading, setStatsLoading] = useState(() => !sessionStorage.getItem("adminStatsCache"));
  const projectStatsCacheRef = useRef({});
  const estateStatsRef = useRef(null);

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
  const [propertiesResult, setPropertiesResult] = useState(() => {
    try {
      const cached = sessionStorage.getItem("adminPropertiesSales_all");
      if (cached) return { period: "all", data: JSON.parse(cached), loading: false, error: false };
    } catch (_) {}
    return { period: null, data: null, loading: true, error: false };
  });

  const [monthlyResult, setMonthlyResult] = useState(() => {
    try {
      const cached = sessionStorage.getItem(`adminMonthlySales_${currentYear}`);
      if (cached) return { year: currentYear, data: JSON.parse(cached), loading: false, error: false };
    } catch (_) {}
    return { year: null, data: null, loading: true, error: false };
  });

  const [availableYears, setAvailableYears] = useState(() => {
    try {
      const cached = sessionStorage.getItem("adminAvailableYears");
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return [currentYear];
  });

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

  // Background prefetch map data during idle time so navigating to View Map is instant (0ms)
  useEffect(() => {
    const prefetchTimer = setTimeout(() => {
      const token = localStorage.getItem("authToken");
      const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      queryClient.prefetchQuery({
        queryKey: ["map-data", "admin"],
        queryFn: async () => {
          const res = await axios.get(`${API_BASE_URL}/api/lots/map-data`, authConfig);
          try {
            sessionStorage.setItem("gde_map_data_cache_admin", JSON.stringify(res.data));
          } catch (_) {}
          return res.data;
        },
        staleTime: 60 * 1000,
      });
    }, 1200);

    return () => clearTimeout(prefetchTimer);
  }, []);

  // Instant 0ms switch handler: updates the stats cards immediately from cache/subdivisions
  const handleSelectProject = useCallback((projectId) => {
    setSelectedProject(projectId);

    if (projectId === "all") {
      if (estateStatsRef.current) {
        setStats(estateStatsRef.current);
      }
      return;
    }

    const cached = projectStatsCacheRef.current[String(projectId)];
    if (cached) {
      setStats(cached);
      return;
    }

    // Instant optimistic projection directly from pre-loaded subdivisions
    setStats((prev) => {
      const subdiv = prev.subdivisions?.find((s) => String(s.property_id) === String(projectId));
      if (!subdiv) return prev;
      return {
        ...prev,
        propertyId: subdiv.property_id,
        propertyName: subdiv.property_name,
        placeLocation: subdiv.location || "Iloilo",
        totalLots: subdiv.totalLots || 0,
        soldLots: subdiv.soldLots || 0,
        availableLots: subdiv.availableLots || 0,
        pendingLots: subdiv.pendingLots || 0,
        totalParcels: subdiv.totalParcels || 0,
        nonSaleableLots: subdiv.nonSaleableLots || 0,
        totalClients: subdiv.totalClients || 0,
      };
    });
  }, []);

  // Fetch Dashboard Stats based on selected project with silent background revalidation
  useEffect(() => {
    let isCancelled = false;

    // Only dim stats if switching to an uncached project
    if (selectedProject !== "all" && !projectStatsCacheRef.current[String(selectedProject)]) {
      setStatsLoading(true);
    }

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

          if (selectedProject === "all") {
            estateStatsRef.current = newStats;
            try { sessionStorage.setItem("adminStatsCache", JSON.stringify(newStats)); } catch (e) {}

            // Pre-warm projectStatsCacheRef from subdivisions array for instant subsequent clicks
            if (Array.isArray(response.data.subdivisions)) {
              response.data.subdivisions.forEach((s) => {
                projectStatsCacheRef.current[String(s.property_id)] = {
                  propertyId: s.property_id,
                  propertyName: s.property_name,
                  placeLocation: s.location || "Iloilo",
                  totalLots: s.totalLots || 0,
                  soldLots: s.soldLots || 0,
                  availableLots: s.availableLots || 0,
                  pendingLots: s.pendingLots || 0,
                  totalParcels: s.totalParcels || 0,
                  nonSaleableLots: s.nonSaleableLots || 0,
                  totalClients: s.totalClients || 0,
                  subdivisions: response.data.subdivisions,
                };
              });
            }
          } else {
            projectStatsCacheRef.current[String(selectedProject)] = newStats;
          }

          setStats(newStats);
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

    // Stale-while-revalidate: check cache before forcing loading state
    let cachedData = null;
    try {
      const stored = sessionStorage.getItem(`adminPropertiesSales_${activePeriod}`);
      if (stored) cachedData = JSON.parse(stored);
    } catch (_) {}

    if (cachedData) {
      setPropertiesResult({ period: activePeriod, data: cachedData, loading: false, error: false });
    } else {
      setPropertiesResult({ period: activePeriod, data: null, loading: true, error: false });
    }

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
          try {
            sessionStorage.setItem(`adminPropertiesSales_${activePeriod}`, JSON.stringify(response.data));
          } catch (_) {}
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching time-based property stats:", error);
          if (!cachedData) {
            setPropertiesResult({ period: activePeriod, data: null, loading: false, error: true });
          }
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

    // Stale-while-revalidate: check cache before forcing loading state
    let cachedData = null;
    try {
      const stored = sessionStorage.getItem(`adminMonthlySales_${selectedYear}`);
      if (stored) cachedData = JSON.parse(stored);
    } catch (_) {}

    if (cachedData) {
      setMonthlyResult({ year: selectedYear, data: cachedData, loading: false, error: false });
    } else {
      setMonthlyResult({ year: selectedYear, data: null, loading: true, error: false });
    }

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
          try {
            sessionStorage.setItem(`adminMonthlySales_${selectedYear}`, JSON.stringify(response.data));
          } catch (_) {}
          if (Array.isArray(response.data?.availableYears)) {
            setAvailableYears(response.data.availableYears);
            try {
              sessionStorage.setItem("adminAvailableYears", JSON.stringify(response.data.availableYears));
            } catch (_) {}
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching monthly sales data:", error);
          if (!cachedData) {
            setMonthlyResult({ year: selectedYear, data: null, loading: false, error: true });
          }
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
        onSelectProject={handleSelectProject}
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
            onSubdivisionSelect={handleSelectProject}
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
            onSelectProperty={handleSelectProject}
          />
        </div>
      </div>

      {/* Detailed Data Table */}
      <div className="pt-2">
        <RecentTransactions
          selectedPropertyId={selectedProject}
          onClearPropertyFilter={() => handleSelectProject("all")}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
