import React from "react";
import { Outlet } from "react-router-dom";
import { EmployeeSidebar } from "./EmployeeSidebar";
import { EmployeeHeader } from "./EmployeeHeader";
import "./employee.css";

export function EmployeeLayout() {
  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* Sidebar */}
      <EmployeeSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <EmployeeHeader />

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
