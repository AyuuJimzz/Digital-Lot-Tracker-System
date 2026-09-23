import React from "react";
import { X, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react";

/**
 * Formats relative time string for activity timestamp.
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Recently";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Returns corresponding activity type icon.
 */
export const getActivityIcon = (act) => {
  if (act.type === "SALE") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />;
  }
  if (act.type === "CANCELLATION") {
    return <XCircle className="w-3.5 h-3.5 text-orange-400" />;
  }
  return <Clock className="w-3.5 h-3.5 text-amber-400" />;
};

const EmployeeActivityModal = ({
  employee,
  activities = [],
  loadingActivities = false,
  onClose,
}) => {
  if (!employee) return null;

  const initials =
    (employee.first_name?.[0] || "") + (employee.last_name?.[0] || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-sm font-bold shadow-md uppercase shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                {employee.first_name} {employee.last_name}
                <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
                  (ID #{employee.employee_id})
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {employee.email} • Sales & Reservation History
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Timeline */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loadingActivities ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Loading sales & reservation history...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="text-sm font-medium">No sales or reservations recorded yet</p>
              <p className="text-xs mt-1">
                Lot sales and reservations handled by this agent will appear here.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-800">
              {activities.map((act) => (
                <div key={act.id} className="relative group">
                  {/* Timeline Dot Icon */}
                  <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                    {getActivityIcon(act)}
                  </div>
                  {/* Card Content */}
                  <div className="bg-gray-50/70 dark:bg-slate-800/50 hover:bg-gray-100/80 dark:hover:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                        {act.title}
                      </h4>
                      <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {act.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 mt-2 font-mono">
                      <Calendar className="w-3 h-3 opacity-60" />
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeActivityModal;
