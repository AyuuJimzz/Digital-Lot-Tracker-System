import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Map, Users, Building2, Settings } from "lucide-react";
import logo from "../../assets/image/golden-dragon-logo.png";

const navItems = [
  {
    title: "Dashboard",
    url: "/admin-panel",
    icon: LayoutDashboard,
  },
  { title: "Manage Employees", url: "/manage-employees", icon: Users },
  { title: "Manage Properties", url: "/manage-properties", icon: Building2 },
  { title: "Map View", url: "/manage-lots", icon: Map },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AdminSidebar() {
  return (
    <aside className="fixed left-0 top-0 w-56 h-screen bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-slate-300 flex flex-col shrink-0 border-r border-gray-200 dark:border-slate-800 transition-colors duration-300 z-40">
      {/* Sidebar Logo / Header */}
      <div className="p-4 text-center border-b border-gray-200 dark:border-slate-800">
        <img
          src={logo}
          alt="Golden Dragon Logo"
          className="mx-auto h-11 w-11 rounded-full object-cover ring-2 ring-amber-500/40"
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/admin-panel"}
            onClick={() => {
              if (item.url === "/manage-lots") {
                window.dispatchEvent(new CustomEvent("toggleMapOverview"));
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors duration-200 ${
                isActive
                  ? "bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                  : "text-gray-700 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* Optional Footer Space */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-slate-500">
          <span>Admin System v1.0</span>
        </div>
      </div>
    </aside>
  );
}
