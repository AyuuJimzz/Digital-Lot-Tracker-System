import React from "react";

const COLOR_PALETTES = [
  {
    bar: "bg-gradient-to-r from-amber-500 to-amber-400 shadow-sm shadow-amber-500/20",
    dot: "bg-amber-400",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    bar: "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/20",
    dot: "bg-emerald-400",
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    bar: "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-sm shadow-blue-500/20",
    dot: "bg-blue-400",
    badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    bar: "bg-gradient-to-r from-purple-500 to-indigo-400 shadow-sm shadow-purple-500/20",
    dot: "bg-purple-400",
    badge: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    bar: "bg-gradient-to-r from-rose-500 to-pink-400 shadow-sm shadow-rose-500/20",
    dot: "bg-rose-400",
    badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
];

const LotsSoldProperties = ({ properties, selectedMonth, months, onMonthChange }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between h-full transition-colors duration-300">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lots Sold</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              by Subdivision
            </span>
          </div>
          <select
            value={selectedMonth}
            onChange={onMonthChange}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {!properties || properties.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              No subdivision property data available.
            </div>
          ) : (
            properties.map((property, index) => {
              const palette = COLOR_PALETTES[index % COLOR_PALETTES.length];
              const total = Number(property.total) || 1;
              const sold = Number(property.sold) || 0;
              const pct = Math.min(Math.round((sold / total) * 1000) / 10, 100);

              return (
                <div key={property.property_id || index} className="space-y-2 group">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-gray-900 dark:text-slate-200 flex items-center gap-1.5 truncate max-w-[180px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                      <span className="truncate">{property.name}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-gray-500 dark:text-slate-400 text-[11px]">
                        <strong className="text-gray-900 dark:text-white font-semibold">{sold}</strong> of {total} Lots
                      </span>
                      {sold > 0 && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${palette.badge}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full bg-gray-100 dark:bg-slate-800/90 border border-gray-200/50 dark:border-slate-700/40 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sold > 0 ? palette.bar : "bg-transparent"
                      }`}
                      style={{
                        width: `${Math.max(pct, sold > 0 ? 3 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LotsSoldProperties;
