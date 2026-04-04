import React from "react";

const StatCard = ({ title, value }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
      <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
    </div>
  );
};

export default StatCard;
