import React, { useState, useEffect } from "react";
import { CalendarDays, History } from "lucide-react";
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
  customSoldOn,
  setCustomSoldOn,
  isLegacyUndated,
  setIsLegacyUndated,
  isAdmin,
  isSaving = false,
}) => {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  useEffect(() => {
    if (status !== "Sold") {
      setIsCustomDateOpen(false);
    }
  }, [status]);
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
        disabled={isLockedForUser || isSaving}
        title={isSaving ? "Saving..." : isLockedForUser ? (status === "Sold" ? "Only Admins can change status of sold lots" : "Only the assigned agent or Admin can modify this reservation") : ""}
        className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none dark:bg-slate-700 ${getStatusColorClasses(
          status
        )} ${isLockedForUser || isSaving ? "cursor-not-allowed opacity-75" : ""}`}
      >
        {["Available", "Pending", "Sold"]
          .filter((s) => allowedStatuses.includes(s))
          .map((s) => {
            const isOptionDisabled =
              (s === "Available" && !canCancelReservation && status === "Pending") ||
              (s === "Pending" && originalStatus === "Sold");
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
                {s} {isOptionDisabled
                  ? s === "Pending" ? "(Revert sale to Available first)" : "(Locked - Reserving Agent/Admin only)"
                  : ""}
              </option>
            );
          })}
      </select>
      {(status === "Pending" || status === "Sold") && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/30">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {status === "Pending" ? "Reserved on" : "Sold on"}
              </p>
              {status === "Sold" && isAdmin && (
                <button
                  type="button"
                  id="lot-past-date-toggle"
                  onClick={() => setIsCustomDateOpen((prev) => !prev)}
                  title={
                    isCustomDateOpen
                      ? "Hide past date options"
                      : "Set past sale date or mark as old record"
                  }
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all ${
                    isCustomDateOpen
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 ring-1 ring-blue-400/30"
                      : isLegacyUndated || customSoldOn
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                      : "text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  }`}
                >
                  <History className="h-3 w-3" />
                  <span>
                    {isCustomDateOpen ? "Close" : "Past Date"}
                  </span>
                </button>
              )}
            </div>

            {/* Collapsed Default State */}
            {!(status === "Sold" && isAdmin && isCustomDateOpen) ? (
              <div className="mt-1">
                {status === "Sold" && isLegacyUndated ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    ⚠️ Date unverified (Old Record)
                  </span>
                ) : status === "Sold" && customSoldOn ? (
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatStatusDate(customSoldOn, true) || customSoldOn}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formattedDate ||
                      (originalStatus === status
                        ? status === "Sold"
                        ? "Date unverified"
                        : "Not recorded"
                        : "Recorded when saved (Today)")}
                  </p>
                )}
              </div>
            ) : (
              /* Expanded Custom Past Date / Old Record Panel */
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/70 space-y-2">
                {isLegacyUndated ? (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5 border border-amber-200 dark:border-amber-800/60">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 mb-1">
                      ⚠️ Date unverified (Old Record)
                    </span>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                      This lot is marked as sold without an exact sale date. It will be cataloged under <em>Old Records</em> and excluded from monthly revenue charts until verified.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Past Sale Date
                    </label>
                    <input
                      type="date"
                      value={customSoldOn || ""}
                      onChange={(e) => setCustomSoldOn && setCustomSoldOn(e.target.value)}
                      max={(() => {
                        try {
                          return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
                        } catch {
                          return new Date().toISOString().slice(0, 10);
                        }
                      })()}
                      disabled={isSaving}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                      {customSoldOn
                        ? "✓ Verified sale date entered"
                        : "Optional: Leave blank for today's date, or select an earlier sale date."}
                    </span>
                  </div>
                )}

                <label className="flex items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="legacy-undated-checkbox"
                    checked={Boolean(isLegacyUndated)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsLegacyUndated && setIsLegacyUndated(checked);
                      if (checked && setCustomSoldOn) {
                        setCustomSoldOn("");
                      }
                    }}
                    disabled={isSaving}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    Mark as Old Sale without Date (Leave Undated)
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LotStatusSection;
