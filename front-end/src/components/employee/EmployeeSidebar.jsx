import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Home, FileText, Settings, Map, Users, ChevronLeft, ChevronRight } from "lucide-react";
import logo from "../../assets/image/golden-dragon-logo.png";

const navItems = [
  { title: "Dashboard", url: "/employee-panel", icon: LayoutDashboard },
  { title: "Map View", url: "/employee/map-view", icon: Map },
  { title: "Properties", url: "/employee/my-properties", icon: Home },
  { title: "Sales", url: "/employee/my-sales", icon: FileText },
  { title: "Clients", url: "/employee/my-clients", icon: Users },
  { title: "Settings", url: "/employee/settings", icon: Settings },
];

export function EmployeeSidebar() {
  // Auto-collapse on tablet (768–1023px), expand on desktop (1024px+)
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setCollapsed(false);
      } else {
        setCollapsed(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Emit sidebar width change so header/main can react
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sidebarToggle", { detail: { collapsed } }));
  }, [collapsed]);

  const sidebarWidth = collapsed ? "w-16" : "w-56";
  const sidebarWidthPx = collapsed ? "4rem" : "14rem";

  return (
    <aside
      className={`fixed left-0 top-0 ${sidebarWidth} h-screen bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-slate-300 flex flex-col shrink-0 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 z-40`}
      style={{ width: sidebarWidthPx }}
    >
      {/* Sidebar Logo */}
      <div className="p-4 text-center border-b border-gray-200 dark:border-slate-800 flex items-center justify-center">
        <img
          src={logo}
          alt="Golden Dragon Logo"
          className="h-12 w-12 rounded-full object-cover ring-2 ring-amber-500/40 flex-shrink-0"
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/employee-panel"}
            onClick={() => {
              if (item.url === "/employee/map-view") {
                window.dispatchEvent(new CustomEvent("toggleMapOverview"));
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-200 ${
                isActive
                  ? "bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                  : "text-gray-700 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse Toggle Button */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center w-full p-2 rounded-md text-gray-500 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 dark:text-slate-500 mt-1">
            <span>Employee System v1.0</span>
          </div>
        )}
      </div>
    </aside>
  );
}
