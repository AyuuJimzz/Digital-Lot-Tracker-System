import React from "react";

const LotsSoldProperties = ({ properties, selectedMonth, months, onMonthChange }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lots Sold</h3>
        <select
          value={selectedMonth}
          onChange={onMonthChange}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {properties.map((property, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {property.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {property.sold} of {property.total} Lots
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className={`${property.color} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${(property.sold / property.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LotsSoldProperties;
