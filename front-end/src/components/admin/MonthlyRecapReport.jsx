import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MonthlyRecapReport = ({ data, selectedYear, availableYears = [], onYearChange, isLoading = false, hasError = false }) => {
  const chartData = Array.isArray(data) ? data : data?.monthlyData || [];
  const currentYear = new Date().getFullYear();
  const activeYear = Number(selectedYear || data?.year || currentYear);

  // Derive distinct selectable years: prioritize passed list or data list, ensuring activeYear & currentYear exist
  const rawYears = availableYears.length > 0
    ? availableYears
    : data?.availableYears || [currentYear];
  const yearSet = new Set([currentYear, activeYear, ...rawYears]);
  const yearOptions = Array.from(yearSet).sort((a, b) => b - a);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Monthly Recap Report
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Year {activeYear} sales volume trend
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Selector Dropdown */}
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
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorLots" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.45} />
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
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#1e293b",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#f8fafc",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
            }}
            itemStyle={{ color: "#38bdf8", fontWeight: "600" }}
            labelStyle={{ color: "#94a3b8", fontWeight: "600", marginBottom: "2px" }}
            formatter={(value) => [`${value} Lots Sold`, "Sales"]}
          />
          <Area
            type="monotone"
            dataKey="lotsSold"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorLots)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {chartData.length > 0 && chartData.every((item) => Number(item.lotsSold) === 0) && (
        <div className="mt-3 text-center py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-dashed border-gray-200 dark:border-slate-700/80">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            No verified sales recorded for {activeYear}.
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default MonthlyRecapReport;
