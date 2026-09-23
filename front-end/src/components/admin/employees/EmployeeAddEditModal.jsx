import React from "react";
import { X, KeyRound } from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all";

const EmployeeAddEditModal = ({
  isOpen,
  editingEmployee,
  formData,
  onChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-4xl mx-auto transition-all">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editingEmployee ? "Edit Employee Details" : "Add New Employee"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Fill in the employee credentials and profile information
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="employee-first-name"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5"
            >
              First Name *
            </label>
            <input
              id="employee-first-name"
              type="text"
              name="first_name"
              value={formData.first_name || ""}
              onChange={onChange}
              placeholder="e.g. Juan"
              required
              className={inputCls}
            />
          </div>

          <div>
            <label
              htmlFor="employee-last-name"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5"
            >
              Last Name *
            </label>
            <input
              id="employee-last-name"
              type="text"
              name="last_name"
              value={formData.last_name || ""}
              onChange={onChange}
              placeholder="e.g. Dela Cruz"
              required
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="employee-email"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5"
            >
              Email Address *
            </label>
            <input
              id="employee-email"
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={onChange}
              placeholder="e.g. juan@goldendragon.com"
              required
              autoComplete="new-email"
              className={inputCls}
            />
          </div>

          {!editingEmployee && (
            <div className="md:col-span-2 p-3.5 bg-gray-50/80 dark:bg-slate-800/40 border border-gray-200/80 dark:border-slate-700/60 rounded-xl flex items-start gap-3 text-xs">
              <div className="p-1.5 rounded-lg bg-gray-200/60 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400 shrink-0 mt-0.5">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-slate-200">
                  Auto-Generated Password & Email Dispatch
                </p>
                <p className="text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed font-normal">
                  A secure temporary password will be automatically generated and emailed to this staff member. They will be prompted to set their own private password upon their first login.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/25 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
          >
            {editingEmployee ? "Update Employee" : "Create & Send Credentials"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeAddEditModal;
