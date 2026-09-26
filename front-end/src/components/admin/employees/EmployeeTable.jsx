import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, History, ArrowRightLeft, UserX, UserCheck, MoreVertical } from "lucide-react";

/**
 * Calculates human-readable presence/activity status for an employee.
 */
export const getEmployeeActivityStatus = (employee) => {
  if (employee.status === "inactive") {
    return {
      label: "Inactive (Disabled)",
      textCls: "text-rose-500 dark:text-rose-400 font-semibold",
      dotCls: "bg-rose-500",
      pulse: false,
      title: "Account is disabled/deactivated. Login access is blocked.",
    };
  }

  const lastActiveTimestamp = employee.last_login;
  if (!lastActiveTimestamp) {
    return {
      label: "No login recorded",
      textCls: "text-gray-500 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-500",
      pulse: false,
      title: "This account has no recorded sign-in",
    };
  }

  const lastActiveDate = new Date(lastActiveTimestamp);
  if (isNaN(lastActiveDate.getTime())) {
    return {
      label: "Login time unavailable",
      textCls: "text-gray-500 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-500",
      pulse: false,
      title: "Last sign-in timestamp is invalid",
    };
  }

  const diffMinutes = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60));

  // A recent login does not prove the employee is still online.
  if (diffMinutes <= 15) {
    return {
      label: "Signed in recently",
      textCls: "text-emerald-600 dark:text-emerald-400",
      dotCls: "bg-emerald-500 dark:bg-emerald-400",
      pulse: false,
      title: "Signed in within the last 15 minutes; live presence is not tracked",
    };
  }

  // 2. Active X mins ago (< 60 mins)
  if (diffMinutes < 60) {
    return {
      label: `Signed in ${diffMinutes}m ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last signed in ${diffMinutes} minutes ago`,
    };
  }

  const diffHours = Math.floor(diffMinutes / 60);
  // 3. Active X hours ago (< 24 hrs)
  if (diffHours < 24) {
    return {
      label: `Signed in ${diffHours}h ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last signed in ${diffHours} hours ago`,
    };
  }

  const diffDays = Math.floor(diffHours / 24);
  // 4. Active Yesterday
  if (diffDays === 1) {
    return {
      label: "Signed in yesterday",
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: "Last signed in yesterday",
    };
  }

  // 5. Active X days ago (<= 30 days)
  if (diffDays <= 30) {
    return {
      label: `Signed in ${diffDays}d ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last signed in ${diffDays} days ago`,
    };
  }

  // 6. Inactive (30+ days)
  return {
    label: "No login in 30+ days",
    textCls: "text-gray-400 dark:text-slate-500",
    dotCls: "bg-gray-300 dark:bg-slate-600",
    pulse: false,
    title: "No sign-in for over 30 days; account remains enabled",
  };
};

const EmployeeTable = ({
  employees = [],
  onViewActivity,
  onEdit,
  onDelete,
  onHandover,
  onToggleStatus,
}) => {
  const [activeMenu, setActiveMenu] = useState(null); // { employee, top, left, bottom, openUpwards }
  const menuRef = useRef(null);

  useEffect(() => {
    if (!activeMenu) return;

    const handleOutsideClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (e.target instanceof Element && e.target.closest(".more-actions-btn")) return;
      setActiveMenu(null);
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") setActiveMenu(null);
    };

    const handleScrollOrResize = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setActiveMenu(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeMenu]);

  const handleToggleMenu = (e, employee) => {
    e.stopPropagation();
    if (activeMenu?.employee?.employee_id === employee.employee_id) {
      setActiveMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownEstimatedHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownEstimatedHeight && rect.top > spaceBelow;

    setActiveMenu({
      employee,
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)),
      openUpwards,
      maxHeight: Math.max(64, (openUpwards ? rect.top : spaceBelow) - 12),
    });
  };
  return (
    <div className="bg-white dark:bg-slate-900 shadow rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Employee List ({employees.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-14 hidden sm:table-cell">
                #
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Employee Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Email Address
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">
                Date Joined
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400"
                >
                  No employees found
                </td>
              </tr>
            ) : (
              employees.map((employee, idx) => {
                const statusInfo = getEmployeeActivityStatus(employee);
                const isInactive = employee.status === "inactive";
                const initials =
                  (employee.first_name?.[0] || "") + (employee.last_name?.[0] || "");

                return (
                  <tr
                    key={employee.employee_id}
                    className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                      isInactive ? "opacity-75 bg-slate-50/40 dark:bg-slate-900/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3.5 text-left text-sm font-bold text-gray-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => onViewActivity(employee)}
                        className="group flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 rounded-lg cursor-pointer"
                        title="Click to view activity history & sales records"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-amber-500/20 uppercase shrink-0 group-hover:ring-blue-500/50 group-hover:scale-105 transition-all">
                          {initials}
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white capitalize leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <span className="flex items-center gap-1.5">
                            {employee.first_name} {employee.last_name}
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                              (View History)
                            </span>
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-slate-300">
                      {employee.email}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusInfo.textCls}`}
                        title={statusInfo.title}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotCls} ${
                            statusInfo.pulse ? "animate-pulse" : ""
                          }`}
                        ></span>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      {employee.created_at
                        ? new Date(employee.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Direct Quick Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenu(null);
                            onEdit(employee);
                          }}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
                          title="Edit Employee Profile"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        {/* 2. More Options (3-Dots) Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleMenu(e, employee)}
                          className={`more-actions-btn p-1.5 rounded-lg transition-colors cursor-pointer ${
                            activeMenu?.employee?.employee_id === employee.employee_id
                              ? "bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white"
                              : "bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
                          }`}
                          title="More Actions"
                          aria-label={`More actions for ${employee.first_name} ${employee.last_name || ""}`}
                          aria-expanded={activeMenu?.employee?.employee_id === employee.employee_id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Floating Portal Dropdown Menu (Free from table overflow / zero clipping & scrollbars) ── */}
      {activeMenu && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: activeMenu.openUpwards ? "auto" : `${activeMenu.top}px`,
            bottom: activeMenu.openUpwards ? `${activeMenu.bottom}px` : "auto",
            left: `${activeMenu.left}px`,
            maxHeight: `${activeMenu.maxHeight}px`,
            zIndex: 99999,
          }}
          className="w-60 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="border-b border-slate-100 px-2.5 pb-2.5 pt-1.5 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Employee actions</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
              {activeMenu.employee.first_name} {activeMenu.employee.last_name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const emp = activeMenu.employee;
              setActiveMenu(null);
              onViewActivity(emp);
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <History className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span>Activity history</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const emp = activeMenu.employee;
              setActiveMenu(null);
              onHandover(emp);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span>Transfer pending clients</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const emp = activeMenu.employee;
              const isInactive = emp.status === "inactive";
              setActiveMenu(null);
              onToggleStatus(emp, isInactive ? "active" : "inactive");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {activeMenu.employee.status === "inactive" ? (
              <>
                <UserCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Reactivate account</span>
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <span>Deactivate account</span>
              </>
            )}
          </button>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            onClick={() => {
              const emp = activeMenu.employee;
              setActiveMenu(null);
              onDelete(emp);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>Delete employee</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmployeeTable;
