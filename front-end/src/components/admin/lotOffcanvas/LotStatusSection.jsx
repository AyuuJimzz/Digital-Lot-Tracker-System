import React from "react";
import { CalendarDays } from "lucide-react";
import { getStatusColorClasses } from "./lotOffcanvasUtils";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});

const formatStatusDate = (value, isDateOnly) => {
  if (!value) return null;
  const date = isDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
};

export const LotStatusSection = ({
  isNonSaleable,
  status,
  setStatus,
  isLockedForUser,
  canCancelReservation = true,
  allowedStatuses = ["Available", "Pending", "Sold"],
  originalStatus,
  pendingSince,
  soldOn,
}) => {
  if (isNonSaleable) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Status
        </label>
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500 inline-block" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Non-Saleable (Common / Amenity Area)
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded flex items-center gap-1">
            🔒 Locked
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          Common ground / facility. Cannot be reserved or sold to prevent accidental bookings. Switch to "Saleable Lot" above to unlock selling.
        </p>
      </div>
    );
  }

  const statusDate = status === "Pending" ? pendingSince : soldOn;
  const formattedDate = formatStatusDate(statusDate, status === "Sold");

  return (
    <div>
      <label
        htmlFor="lot-offcanvas-status"
        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        Status
      </label>
      <select
        id="lot-offcanvas-status"
        name="lot_status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        disabled={isLockedForUser}
        title={isLockedForUser ? (status === "Sold" ? "Only Admins can change status of sold lots" : "Only the assigned agent or Admin can modify this reservation") : ""}
        className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent dark:bg-slate-700 ${getStatusColorClasses(
          status
        )} ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
      >
        {["Available", "Pending", "Sold"]
          .filter((s) => allowedStatuses.includes(s))
          .map((s) => {
            const isOptionDisabled = s === "Available" && !canCancelReservation && status === "Pending";
            return (
              <option
                key={s}
                value={s}
                disabled={isOptionDisabled}
                className={
                  s === "Available"
                    ? "text-green-600"
                    : s === "Pending"
                    ? "text-amber-500"
                    : "text-red-600"
                }
              >
                {s} {isOptionDisabled ? "(Locked - Reserving Agent/Admin only)" : ""}
              </option>
            );
          })}
      </select>
      {(status === "Pending" || status === "Sold") && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/30">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {status === "Pending" ? "Reserved on" : "Sold on"}
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formattedDate || (originalStatus === status ? "Not recorded" : "Recorded when saved")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotStatusSection;
