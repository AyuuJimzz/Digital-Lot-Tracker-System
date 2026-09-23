import React from "react";
import { Edit, Trash2, History } from "lucide-react";

/**
 * Calculates human-readable presence/activity status for an employee.
 */
export const getEmployeeActivityStatus = (employee) => {
  if (employee.status === "inactive") {
    return {
      label: "Disabled",
      textCls: "text-slate-500 dark:text-slate-400",
      dotCls: "bg-slate-500",
      pulse: false,
      title: "Account is disabled",
    };
  }

  const lastActiveTimestamp = employee.last_login || employee.updated_at || employee.created_at;
  if (!lastActiveTimestamp) {
    return {
      label: "Online Now",
      textCls: "text-emerald-600 dark:text-emerald-400",
      dotCls: "bg-emerald-500 dark:bg-emerald-400",
      pulse: true,
      title: "Recently active",
    };
  }

  const lastActiveDate = new Date(lastActiveTimestamp);
  if (isNaN(lastActiveDate.getTime())) {
    return {
      label: "Online Now",
      textCls: "text-emerald-600 dark:text-emerald-400",
      dotCls: "bg-emerald-500 dark:bg-emerald-400",
      pulse: true,
      title: "Active now",
    };
  }

  const diffMinutes = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60));

  // 1. Online now (within 15 minutes)
  if (diffMinutes <= 15) {
    return {
      label: "Online Now",
      textCls: "text-emerald-600 dark:text-emerald-400",
      dotCls: "bg-emerald-500 dark:bg-emerald-400",
      pulse: true,
      title: "Active on the platform now",
    };
  }

  // 2. Active X mins ago (< 60 mins)
  if (diffMinutes < 60) {
    return {
      label: `Active ${diffMinutes}m ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last active ${diffMinutes} minutes ago`,
    };
  }

  const diffHours = Math.floor(diffMinutes / 60);
  // 3. Active X hours ago (< 24 hrs)
  if (diffHours < 24) {
    return {
      label: `Active ${diffHours}h ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last active ${diffHours} hours ago`,
    };
  }

  const diffDays = Math.floor(diffHours / 24);
  // 4. Active Yesterday
  if (diffDays === 1) {
    return {
      label: "Active Yesterday",
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: "Last active yesterday",
    };
  }

  // 5. Active X days ago (<= 30 days)
  if (diffDays <= 30) {
    return {
      label: `Active ${diffDays}d ago`,
      textCls: "text-gray-600 dark:text-slate-400",
      dotCls: "bg-gray-400 dark:bg-slate-400",
      pulse: false,
      title: `Last active ${diffDays} days ago`,
    };
  }

  // 6. Inactive (30+ days)
  return {
    label: "Inactive (30+ days)",
    textCls: "text-gray-400 dark:text-slate-500",
    dotCls: "bg-gray-300 dark:bg-slate-600",
    pulse: false,
    title: "No activity for over 30 days",
  };
};

const EmployeeTable = ({
  employees = [],
  onViewActivity,
  onEdit,
  onDelete,
}) => {
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
                const initials =
                  (employee.first_name?.[0] || "") + (employee.last_name?.[0] || "");

                return (
                  <tr
                    key={employee.employee_id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3.5 text-left text-sm font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-amber-500/20 uppercase shrink-0">
                          {initials}
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white capitalize leading-snug">
                          {employee.first_name} {employee.last_name}
                        </div>
                      </div>
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
                        : "8/31/2026"}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewActivity(employee)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="View Activity History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(employee)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          title="Edit Employee"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(employee)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

export default EmployeeTable;
