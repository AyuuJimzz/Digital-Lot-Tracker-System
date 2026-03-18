import React from "react";

import StatCard from "../../components/Admin/StatCard";
import RecentTransactions from "../../components/Admin/RecentTransactions";

const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Dashboard Overview
        </h1>
      </div>
      {/* Top Row Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Place Location" value="Iloilo City" />
        <StatCard title="Total Lots" value="0" />
        <StatCard title="Lots Sold" value="0" />
      </div>

      {/* Secondary Row Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Lots Available" value="0" />
        <StatCard title="Lots Pending" value="0" />
      </div>

      {/* Detailed Data Table */}
      <div className="pt-2">
        <RecentTransactions />
      </div>
    </div>
  );
};

export default AdminDashboard;
