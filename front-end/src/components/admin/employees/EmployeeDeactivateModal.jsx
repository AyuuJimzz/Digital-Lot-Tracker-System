import React from "react";
import { ArrowRight, LockKeyhole, UserX, X } from "lucide-react";

export const EmployeeDeactivateModal = ({
  isOpen,
  employee,
  isSubmitting,
  onConfirm,
  onOpenTurnover,
  onClose,
}) => {
  if (!isOpen || !employee) return null;

  const employeeName =
    `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Employee";
  const initials =
    `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase() || "E";
  const pendingCount = Number(employee.lots_pending || 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-employee-modal-title"
        aria-describedby="deactivate-employee-modal-description"
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="deactivate-employee-modal-title" className="text-lg font-semibold leading-6 text-slate-900 dark:text-white">
                Deactivate account
              </h2>
              <p id="deactivate-employee-modal-description" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This employee will lose access until reactivated.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{employeeName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{employee.email}</p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-500/5">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {pendingCount} pending {pendingCount === 1 ? "reservation" : "reservations"}
                </p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                These clients will remain assigned to {employeeName} unless you transfer them.
              </p>
              {onOpenTurnover && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTurnover(employee);
                  }}
                  disabled={isSubmitting}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Transfer clients first
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Sales and commission history stays intact. You can reactivate this account later.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Keep active
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            ) : (
              <UserX className="h-4 w-4" aria-hidden="true" />
            )}
            {isSubmitting ? "Deactivating..." : "Deactivate account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDeactivateModal;
