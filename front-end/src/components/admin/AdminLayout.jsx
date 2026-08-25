import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import "./admin.css";

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleSidebarToggle = (e) => {
      setSidebarCollapsed(e.detail.collapsed);
    };
    window.addEventListener("sidebarToggle", handleSidebarToggle);
    return () => window.removeEventListener("sidebarToggle", handleSidebarToggle);
  }, []);

  const paddingLeft = sidebarCollapsed ? "4rem" : "14rem";

  return (
    <div
      className="min-h-screen w-full bg-gray-50 dark:bg-slate-950 transition-all duration-300 overflow-x-hidden"
      style={{ paddingLeft }}
    >
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content wrapper */}
      <div className="flex flex-col min-w-0 w-full min-h-screen">
        {/* Header */}
        <AdminHeader sidebarCollapsed={sidebarCollapsed} />

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden bg-gray-50 dark:bg-slate-950 transition-colors duration-300 pt-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
