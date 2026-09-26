import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, History, Search, X, XCircle } from "lucide-react";

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Time unavailable";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const getActivityIcon = (activity) => {
  if (activity.type === "SALE") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (activity.type === "CANCELLATION") return <XCircle className="h-4 w-4" aria-hidden="true" />;
  return <Clock3 className="h-4 w-4" aria-hidden="true" />;
};

const activityLabels = {
  SALE: "Sale completed",
  RESERVATION: "Reservation created",
  CANCELLATION: "Reservation cancelled",
};

const activityColors = {
  SALE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  RESERVATION: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  CANCELLATION: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const filters = [
  { value: "ALL", label: "All" },
  { value: "SALE", label: "Sales" },
  { value: "RESERVATION", label: "Reservations" },
  { value: "CANCELLATION", label: "Cancellations" },
];

const getDateGroup = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return { key: "unknown", label: "Date unavailable" };
  return {
    key: date.toDateString(),
    label: date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  };
};

const EmployeeActivityModal = ({
  employee,
  activities = [],
  loadingActivities = false,
  error = "",
  onRetry,
  onClose,
}) => {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setActiveFilter("ALL");
    setSearchTerm("");
  }, [employee?.employee_id]);

  useEffect(() => {
    if (!employee) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [employee, onClose]);

  const counts = useMemo(() => ({
    ALL: activities.length,
    SALE: activities.filter((activity) => activity.type === "SALE").length,
    RESERVATION: activities.filter((activity) => activity.type === "RESERVATION").length,
    CANCELLATION: activities.filter((activity) => activity.type === "CANCELLATION").length,
  }), [activities]);

  const groupedActivities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const visible = activities.filter((activity) => {
      if (activeFilter !== "ALL" && activity.type !== activeFilter) return false;
      if (!query) return true;
      return [activity.lot_number, activity.property_name, activity.customer_name, activity.title, activity.description]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });

    const groups = [];
    visible.forEach((activity) => {
      const dateGroup = getDateGroup(activity.timestamp);
      if (groups[groups.length - 1]?.key !== dateGroup.key) {
        groups.push({ ...dateGroup, items: [] });
      }
      groups[groups.length - 1].items.push(activity);
    });
    return groups;
  }, [activities, activeFilter, searchTerm]);

  if (!employee) return null;

  const employeeName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Employee";
  const initials = `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase() || "E";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-[3px] sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="employee-activity-title" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials}</div>
            <div className="min-w-0">
              <h2 id="employee-activity-title" className="text-base font-semibold text-slate-900 dark:text-white">Activity history</h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{employeeName} · {employee.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close activity history" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!loadingActivities && !error && activities.length > 0 && (
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-700">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Sales", count: counts.SALE },
                { label: "Reservations", count: counts.RESERVATION },
                { label: "Cancellations", count: counts.CANCELLATION },
              ].map((summary) => (
                <div key={summary.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-lg font-semibold leading-6 text-slate-900 dark:text-white">{summary.count}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{summary.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 overflow-x-auto" aria-label="Filter activity type">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    aria-pressed={activeFilter === filter.value}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                      activeFilter === filter.value
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {filter.label} <span className="ml-0.5 opacity-75">{counts[filter.value]}</span>
                  </button>
                ))}
              </div>
              <label className="relative block w-full sm:w-56">
                <span className="sr-only">Search activity</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search activity"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {loadingActivities ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" aria-hidden="true" />
              Loading activity...
            </div>
          ) : error ? (
            <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              <button type="button" onClick={onRetry} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">Retry</button>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <History className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">No activity recorded yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sales and reservation events will appear here.</p>
            </div>
          ) : groupedActivities.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Search className="h-7 w-7 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">No matching activity</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another search or filter.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing {groupedActivities.reduce((total, group) => total + group.items.length, 0)} recent events
              </p>
              {groupedActivities.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.label}</h3>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {group.items.map((activity) => {
                      const eventLabel = activityLabels[activity.type] || activity.title || "Activity";
                      const hasStructuredDetails = Boolean(activity.lot_number || activity.property_name || activity.customer_name);
                      const eventDate = new Date(activity.timestamp);
                      const hasValidTime = !Number.isNaN(eventDate.getTime());
                      return (
                        <article key={activity.id} className="flex items-start gap-3 py-3.5 first:pt-2">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activityColors[activity.type] || activityColors.RESERVATION}`}>
                            {getActivityIcon(activity)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{eventLabel}</p>
                            {hasStructuredDetails ? (
                              <>
                                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                                  {[activity.lot_number ? `Lot ${activity.lot_number}` : null, activity.property_name].filter(Boolean).join(" · ")}
                                </p>
                                {activity.customer_name && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Client: {activity.customer_name}</p>}
                              </>
                            ) : activity.description && (
                              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{activity.description}</p>
                            )}
                          </div>
                          <time className="shrink-0 pt-0.5 text-right text-[11px] text-slate-600 dark:text-slate-300" dateTime={hasValidTime ? eventDate.toISOString() : undefined}>
                            {hasValidTime
                              ? eventDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                              : "Time unavailable"}
                            {hasValidTime && <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(activity.timestamp)}</span>}
                          </time>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeActivityModal;
