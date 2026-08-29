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

const MonthlyRecapReport = ({ data }) => {
  const totalYearSold = data ? data.reduce((sum, item) => sum + (Number(item.lotsSold) || 0), 0) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Monthly Recap Report
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Year {new Date().getFullYear()} sales volume trend
          </p>
        </div>
        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-mono font-semibold">
          📈 {totalYearSold} Lots Sold (YTD)
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
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
    </div>
  );
};

export default MonthlyRecapReport;
