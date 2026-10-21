import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  loadCustomColors,
  getThemeForSubdivision,
} from "../../utils/subdivisionColors";

const CustomRecapTooltip = ({ active, payload, label, activeYear, subdivisions }) => {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl text-xs text-white min-w-[170px]">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800">
        <span className="font-semibold text-slate-300">{label} {activeYear}</span>
        <span className="font-mono text-emerald-400 font-bold">{total} Lots Sold</span>
      </div>
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const subdiv = subdivisions.find((s) => s.key === item.dataKey || s.shortName === item.name);
          const displayName = subdiv?.name || item.name;
          return (
            <div key={idx} className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate max-w-[130px]">{displayName}:</span>
              </span>
              <span className="font-mono font-bold text-white ml-2">{item.value || 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MonthlyRecapReport = ({
  data,
  selectedYear,
  availableYears = [],
  onYearChange,
  isLoading = false,
  hasError = false,
}) => {
  const [selectedSubdivision, setSelectedSubdivision] = useState("all"); // "all" | propertyId
  const [customColors, setCustomColors] = useState(() => loadCustomColors());

  useEffect(() => {
    const handleColorUpdate = () => {
      setCustomColors(loadCustomColors());
    };
    window.addEventListener("gde-subdivision-color-changed", handleColorUpdate);
    window.addEventListener("storage", handleColorUpdate);
    return () => {
      window.removeEventListener("gde-subdivision-color-changed", handleColorUpdate);
      window.removeEventListener("storage", handleColorUpdate);
    };
  }, []);

  const chartData = useMemo(() => {
    return Array.isArray(data) ? data : data?.monthlyData || [];
  }, [data]);
  const currentYear = new Date().getFullYear();
  const activeYear = Number(selectedYear || data?.year || currentYear);
  const totalYearSold = typeof data?.totalYearSold === "number"
    ? data.totalYearSold
    : chartData.reduce((sum, item) => sum + (Number(item.lotsSold) || 0), 0);

  // Derive distinct selectable years
  const rawYears = availableYears.length > 0
    ? availableYears
    : data?.availableYears || [currentYear];
  const yearSet = new Set([currentYear, activeYear, ...rawYears]);
  const yearOptions = Array.from(yearSet).sort((a, b) => b - a);

  // Available subdivisions from backend
  const subdivisions = useMemo(() => {
    if (Array.isArray(data?.subdivisions) && data.subdivisions.length > 0) {
      return data.subdivisions;
    }
    const first = chartData[0] || {};
    return Object.keys(first)
      .filter((k) => k.startsWith("subdiv_"))
      .map((k, i) => ({
        id: k.replace("subdiv_", ""),
        name: `Subdivision ${i + 1}`,
        shortName: `Subdiv ${i + 1}`,
        key: k,
      }));
  }, [data, chartData]);

  // Determine which subdivisions have at least 1 sale in this active year
  const subdivisionsWithSales = useMemo(() => {
    return subdivisions.filter((subdiv) => {
      return chartData.some((row) => (Number(row[subdiv.key]) || 0) > 0);
    });
  }, [subdivisions, chartData]);

  // Active subdivisions to plot (prioritize ones with sales when in "all" view to prevent clutter)
  const activeSubdivisions = useMemo(() => {
    if (selectedSubdivision === "all") {
      // If some have sales, plot active ones so flat zero lines don't clutter the bottom
      return subdivisionsWithSales.length > 0 ? subdivisionsWithSales : subdivisions;
    }
    return subdivisions.filter((s) => String(s.id) === String(selectedSubdivision));
  }, [subdivisions, subdivisionsWithSales, selectedSubdivision]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors duration-300">
      {/* Header Section — Clean, Spacious & Uncluttered */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Monthly Recap Report
            </h3>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              {totalYearSold} Sold in {activeYear}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Year {activeYear} monthly sales trend
          </p>
        </div>

        {/* Clean Controls: Year Selector Dropdown */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs shadow-sm">
            <span className="text-gray-400 dark:text-slate-400 font-medium text-[11px]">Year:</span>
            <select
              id="monthly-recap-year-select"
              aria-label="Select year for monthly recap report"
              value={activeYear}
              onChange={(e) => onYearChange && onYearChange(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-gray-900 dark:text-white focus:outline-none cursor-pointer pr-1"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                  {yr} {yr === currentYear ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div role="status" className="h-[300px] flex flex-col items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-xs font-medium">Loading sales for {activeYear}...</span>
        </div>
      ) : hasError ? (
        <div role="alert" className="h-[300px] flex items-center justify-center text-sm text-red-600 dark:text-red-400">
          Unable to load sales for {activeYear}. Please refresh the page.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 14, right: 10, left: -10, bottom: 0 }}>
              <defs>
                {subdivisions.map((subdiv, idx) => {
                  const theme = getThemeForSubdivision(subdiv, idx, customColors);
                  return (
                    <linearGradient key={theme.gradientId} id={theme.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={theme.color} stopOpacity={0.0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.2} vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                label={{
                  value: "Lots Sold",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#94a3b8", fontSize: "11px" },
                }}
              />
              <Tooltip
                content={
                  <CustomRecapTooltip
                    activeYear={activeYear}
                    subdivisions={subdivisions}
                  />
                }
              />
              {activeSubdivisions.map((subdiv, idx) => {
                const theme = getThemeForSubdivision(subdiv, idx, customColors);
                return (
                  <Area
                    key={subdiv.id || subdiv.key}
                    type="monotone"
                    dataKey={subdiv.key}
                    name={subdiv.name}
                    stroke={theme.color}
                    strokeWidth={2.8}
                    fillOpacity={1}
                    fill={`url(#${theme.gradientId})`}
                    dot={{ r: 3, fill: theme.color, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: theme.color, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>

          {/* Interactive Legend Bar under the chart — Spacious & Color-Matched */}
          {subdivisions.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                {/* Reset to All Button */}
                <button
                  type="button"
                  onClick={() => setSelectedSubdivision("all")}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    selectedSubdivision === "all"
                      ? "bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
                  }`}
                >
                  All Subdivisions
                </button>

                {subdivisions.map((subdiv, idx) => {
                  const theme = getThemeForSubdivision(subdiv, idx, customColors);
                  const isSelected = String(selectedSubdivision) === String(subdiv.id);
                  const isFilteredOut = selectedSubdivision !== "all" && !isSelected;

                  return (
                    <button
                      key={subdiv.id}
                      type="button"
                      onClick={() =>
                        setSelectedSubdivision(
                          selectedSubdivision === subdiv.id ? "all" : subdiv.id
                        )
                      }
                      className={`inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                        isFilteredOut ? "opacity-30" : "opacity-100"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span
                        className="font-semibold transition-colors"
                        style={{
                          color: isSelected
                            ? theme.color
                            : undefined,
                        }}
                      >
                        {subdiv.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">
                Click a subdivision to isolate
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MonthlyRecapReport;
