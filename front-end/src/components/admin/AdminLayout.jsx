import React from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import "./admin.css";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen w-full bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <AdminHeader />

        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
