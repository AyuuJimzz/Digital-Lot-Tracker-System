import React from "react";
import { KeyRound, UserRoundPlus, UsersRound, X } from "lucide-react";

const inputCls =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-200";

const EmployeeAddEditModal = ({
  isOpen,
  editingEmployee,
  formData,
  isSubmitting = false,
  onChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(editingEmployee);

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="employee-form-title">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-700">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {isEditing ? <UsersRound className="h-5 w-5" aria-hidden="true" /> : <UserRoundPlus className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 id="employee-form-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Edit employee" : "Add employee"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {isEditing ? "Update this team member’s contact details." : "Set up a new team member’s account."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close employee form"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} aria-busy={isSubmitting}>
        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Employee information</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Fields marked * are required.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="employee-first-name" className={labelCls}>First name *</label>
                <input
                  id="employee-first-name"
                  type="text"
                  name="first_name"
                  value={formData.first_name || ""}
                  onChange={onChange}
                  placeholder="e.g. Juan"
                  required
                  autoComplete="given-name"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="employee-last-name" className={labelCls}>Last name *</label>
                <input
                  id="employee-last-name"
                  type="text"
                  name="last_name"
                  value={formData.last_name || ""}
                  onChange={onChange}
                  placeholder="e.g. Dela Cruz"
                  required
                  autoComplete="family-name"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="employee-email" className={labelCls}>Work email *</label>
                <input
                  id="employee-email"
                  type="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={onChange}
                  placeholder="e.g. juan@goldendragon.com"
                  required
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Account access" : "What happens next"}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isEditing
                ? "Use the employee actions menu to deactivate or reactivate this account. Editing contact details will not change past sales records."
                : "A temporary password will be generated and email delivery will start after the account is created. The employee will set a new password at first sign-in."}
            </p>
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-700 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />}
            {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Create employee"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default EmployeeAddEditModal;
