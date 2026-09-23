import React from "react";

const AccountsTab = ({
  accountTab,
  setAccountTab,
  admins,
  employees,
  handleCreateAdmin,
  adminFullName,
  setAdminFullName,
  adminEmail,
  setAdminEmail,
  showAdminPassword,
  setShowAdminPassword,
  adminPassword,
  setAdminPassword,
  adminError,
  adminSuccess,
  adminLoading,
  setSelectedAdmin,
  setIsEditingAdmin,
  setShowDeleteConfirm,
  setCopiedEmail,
  setResetPasswordVal,
  setResetMsg,
  handleCreateEmployee,
  empFirstName,
  setEmpFirstName,
  empLastName,
  setEmpLastName,
  empEmail,
  setEmpEmail,
  showEmpPassword,
  setShowEmpPassword,
  empPassword,
  setEmpPassword,
  empFormError,
  empFormSuccess,
  empFormLoading,
  employeeSearchQuery,
  setEmployeeSearchQuery,
  handleOpenEmployeeModal,
}) => {
  return (
    <div id="zone-admins" className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden scroll-mt-6 animate-in fade-in duration-150">
      {/* Header & Tabs */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Account Directory & Credentials Override
          </h2>
          <p className="text-xs text-slate-400">Manage administrator & employee accounts, provision access, and perform instant password overrides</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAccountTab("ADMINS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              accountTab === "ADMINS"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🛡️</span>
            <span>Admins</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
              {admins.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAccountTab("EMPLOYEES")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              accountTab === "EMPLOYEES"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>👔</span>
            <span>Employees / Agents</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
              {employees.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Admins */}
      {accountTab === "ADMINS" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 animate-in fade-in duration-150">
          {/* Left: Create Admin Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Provision New Admin</h3>
            <p className="text-xs text-slate-400 mb-4">Add new administrator credentials directly into the database.</p>

            <form onSubmit={handleCreateAdmin} autoComplete="off" className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  autoComplete="off"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@goldendragon.com"
                  autoComplete="off"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  >
                    {showAdminPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {adminError && <div className="text-red-400 text-xs font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{adminError}</div>}
              {adminSuccess && <div className="text-emerald-400 text-xs font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">{adminSuccess}</div>}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {adminLoading ? "Registering Admin..." : "Create Admin Account"}
              </button>
            </form>
          </div>

          {/* Right: Registered Admins List (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Active Administrator Accounts</h3>
              <p className="text-xs text-slate-400 mb-4">Direct records extracted from the platform database.</p>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {admins.length === 0 ? (
                  <div className="text-slate-500 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                    No admin accounts found.
                  </div>
                ) : (
                  admins.map((adm) => (
                    <div
                      key={adm.admin_id}
                      className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {(adm.full_name || "A").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{adm.full_name || "Administrator"}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{adm.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                          ID #{adm.admin_id}
                        </span>

                        <button
                          onClick={() => {
                            setSelectedAdmin(adm);
                            setIsEditingAdmin(false);
                            setShowDeleteConfirm(false);
                            setCopiedEmail(false);
                            setResetPasswordVal("");
                            setResetMsg({ text: "", isError: false });
                          }}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                          title="View account details"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>Click "View" on any admin to inspect or modify account credentials.</span>
              <span className="font-mono text-slate-400 font-semibold">{admins.length} Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employees / Agents */}
      {accountTab === "EMPLOYEES" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 animate-in fade-in duration-150">
          {/* Left: Create Employee Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Provision New Employee / Agent</h3>
            <p className="text-xs text-slate-400 mb-4">Add new employee or field agent credentials directly into database.</p>

            <form onSubmit={handleCreateEmployee} autoComplete="off" className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={empFirstName}
                    onChange={(e) => setEmpFirstName(e.target.value)}
                    placeholder="Juan"
                    autoComplete="off"
                    className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={empLastName}
                    onChange={(e) => setEmpLastName(e.target.value)}
                    placeholder="Dela Cruz"
                    autoComplete="off"
                    className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  placeholder="employee@goldendragon.com"
                  autoComplete="off"
                  className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showEmpPassword ? "text" : "password"}
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition text-white placeholder-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmpPassword(!showEmpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  >
                    {showEmpPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {empFormError && <div className="text-red-400 text-xs font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{empFormError}</div>}
              {empFormSuccess && <div className="text-teal-300 text-xs font-medium bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/20">{empFormSuccess}</div>}

              <button
                type="submit"
                disabled={empFormLoading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50"
              >
                {empFormLoading ? "Registering Employee..." : "Create Employee Account"}
              </button>
            </form>
          </div>

          {/* Right: Registered Employees List (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5">Active Employee Accounts</h3>
                  <p className="text-xs text-slate-400">Registered staff & agents with active portal access.</p>
                </div>
              </div>

              {/* Search Filter */}
              <div className="mb-3">
                <input
                  type="text"
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder="Search employees by name, email, or phone..."
                  className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:border-teal-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                {employees.length === 0 ? (
                  <div className="text-slate-500 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                    No employee accounts found.
                  </div>
                ) : (
                  employees
                    .filter((emp) => {
                      if (!employeeSearchQuery.trim()) return true;
                      const q = employeeSearchQuery.toLowerCase();
                      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
                      const email = (emp.email || "").toLowerCase();
                      return fullName.includes(q) || email.includes(q);
                    })
                    .map((emp) => (
                      <div
                        key={emp.employee_id}
                        className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {(emp.first_name || "E").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{emp.first_name} {emp.last_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{emp.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                            ID #{emp.employee_id}
                          </span>

                          <button
                            onClick={() => handleOpenEmployeeModal(emp)}
                            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm"
                            title="Manage employee and override password"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <circle cx="12" cy="16" r="1" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Manage
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>Click "Manage" on any employee for instant password overrides or details.</span>
              <span className="font-mono text-slate-400 font-semibold">{employees.length} Total</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsTab;
