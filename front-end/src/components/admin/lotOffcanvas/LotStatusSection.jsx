import React from "react";
import { getStatusColorClasses } from "./lotOffcanvasUtils";

export const LotStatusSection = ({
  isNonSaleable,
  status,
  setStatus,
  isLockedForUser,
  allowedStatuses = ["Available", "Pending", "Sold"],
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

  return (
    <div>
      <label
        htmlFor="lot-offcanvas-status"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        Status
      </label>
      <select
        id="lot-offcanvas-status"
        name="lot_status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        disabled={isLockedForUser}
        title={isLockedForUser ? "Only Admins can change status of sold lots" : ""}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${getStatusColorClasses(
          status
        )} ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
      >
        {["Available", "Pending", "Sold"]
          .filter((s) => allowedStatuses.includes(s))
          .map((s) => (
            <option
              key={s}
              value={s}
              className={
                s === "Available"
                  ? "text-green-600"
                  : s === "Pending"
                  ? "text-amber-500"
                  : "text-red-600"
              }
            >
              {s}
            </option>
          ))}
      </select>
    </div>
  );
};

export default LotStatusSection;
