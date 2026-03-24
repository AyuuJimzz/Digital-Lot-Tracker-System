import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Home, FileText, BarChart3, Settings, Map, Users } from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    url: "/employee-panel",
    icon: LayoutDashboard,
  },
  { title: "Map View", url: "/employee/map-view", icon: Map },
  { title: "My Properties", url: "/employee/my-properties", icon: Home },
  { title: "My Sales", url: "/employee/my-sales", icon: FileText },
  { title: "My Clients", url: "/employee/my-clients", icon: Users },
  { title: "Analytics", url: "/employee/analytics", icon: BarChart3 },
  { title: "Settings", url: "/employee/settings", icon: Settings },
];

export function EmployeeSidebar() {
  return (
    <aside className="w-56 min-h-screen bg-gray-50 text-gray-700 flex flex-col shrink-0 border-r border-gray-200">
      {/* Sidebar Logo / Header */}
      <div className="p-6 text-center border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">LOGO</h2>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/employee-panel"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors duration-200 ${
                isActive
                  ? "bg-gray-200 text-gray-900 font-medium"
                  : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* Optional Footer Space */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500">
          <span>Employee System v1.0</span>
        </div>
      </div>
    </aside>
  );
}
