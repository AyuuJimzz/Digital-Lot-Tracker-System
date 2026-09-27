import React from "react";

export default function DemoDataModal({
  showDemoDataModal,
  setShowDemoDataModal,
  demoModalTab,
  setDemoModalTab,
  fetchDemoStaffStatus,
  demoDataCount,
  setDemoDataCount,
  demoDataLoading,
  demoDataSuccessMsg,
  handleGenerateDemoDataConfirm,
  showDemoPasswords,
  setShowDemoPasswords,
  demoEmployeesList,
  handleCopyText,
  copiedKey,
  handleToggleDemoEmployee,
  demoEmpLoading,
  demoEmpSuccessMsg,
  handleDeactivateAllDemoEmployees,
  handleGenerateDemoEmployees,
}) {
  if (!showDemoDataModal) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800/70 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 text-xl">
              🎲
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Capstone Demo Data Generator</h3>
              <p className="text-xs text-slate-400">Generate realistic inquiries, sales & test employee accounts</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDemoDataModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 -mx-6 px-6 gap-2">
          <button
            type="button"
            onClick={() => setDemoModalTab("transactions")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              demoModalTab === "transactions"
                ? "border-slate-700 text-slate-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🎲</span> Sample Transactions
          </button>
          <button
            type="button"
            onClick={() => {
              setDemoModalTab("employees");
              fetchDemoStaffStatus?.();
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              demoModalTab === "employees"
                ? "border-slate-700 text-slate-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>👥</span> Demo Staff Accounts
            <span className="px-1.5 py-0.2 bg-slate-800/70 text-slate-300 rounded-full text-[10px]">
              {demoEmployeesList?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: TRANSACTIONS GENERATOR */}
        {demoModalTab === "transactions" ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Automatically create realistic sample buyer accounts and map transactions across your subdivision lots to make your Admin Dashboard charts, sales revenue, and lot status maps look active and full.
            </p>

            {/* Quantity Selector */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Number of sample transactions to generate:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[4, 8, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDemoDataCount(num)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      demoDataCount === num
                        ? "bg-slate-800/70 text-slate-300 border-slate-700 shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span>✨</span> {num} Records
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>✓</span> Auto-generates:
              </div>
              <p>• Realistic Filipino buyer names, emails, contact numbers, & addresses.</p>
              <p>• Mix of Cash, Installment, and No Downpayment transactions.</p>
              <p>• Lots will update to <strong>Sold</strong>, <strong>Pending</strong>, or <strong>Cancelled</strong> with past timestamps.</p>
              <p className="pt-1 text-slate-300 font-medium flex items-center gap-1">
                <span>👥</span> Transactions are distributed across currently active Staff Accounts and Admin (never creates staff accounts).
              </p>
            </div>

            {demoDataSuccessMsg && (
              <div className="p-3 bg-slate-800/70 border border-slate-700 text-slate-300 text-xs rounded-xl font-medium">
                🎉 {demoDataSuccessMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDemoDataModal(false)}
                disabled={demoDataLoading}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleGenerateDemoDataConfirm}
                disabled={demoDataLoading}
                className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50 cursor-pointer"
              >
                {demoDataLoading ? "Generating Records..." : "🎲 Generate Demo Transactions"}
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: DEMO EMPLOYEES GENERATOR & CREDENTIALS VIEWER */
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300 leading-relaxed">
                Pre-configured employee accounts. Activate or deactivate them individually or in bulk.
              </p>
              <button
                type="button"
                onClick={() => setShowDemoPasswords(!showDemoPasswords)}
                className="text-[11px] text-slate-300 hover:text-slate-300 font-semibold px-2 py-1 rounded bg-slate-800/70 border border-slate-700 shrink-0 transition cursor-pointer"
              >
                {showDemoPasswords ? "👁️ Hide Passwords" : "🔒 Reveal Passwords"}
              </button>
            </div>

            {/* List of Demo Accounts with Readable Passwords & Activate/Deactivate Toggle */}
            <div className="space-y-2.5">
              {demoEmployeesList?.map((emp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-xl space-y-2.5 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800/70 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {(emp.name || "E").charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{emp.name}</h4>
                          {emp.isActive ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800/70 text-slate-300 border border-slate-700">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Deactivated
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-300 font-medium">Role: {emp.role || "Staff / Employee"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyText(`all-${idx}`, `Email: ${emp.email}\nPassword: ${emp.password}`)}
                        className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 font-medium cursor-pointer"
                      >
                        {copiedKey === `all-${idx}` ? "✓ Copied!" : "📋 Copy Login"}
                      </button>

                      {emp.isActive ? (
                        <button
                          type="button"
                          onClick={() => handleToggleDemoEmployee(emp.email, "deactivate")}
                          disabled={demoEmpLoading}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-500/30 transition font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleDemoEmployee(emp.email, "activate")}
                          disabled={demoEmpLoading}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-600 hover:bg-slate-500 text-white transition font-bold shadow-sm shadow-black/10 disabled:opacity-50 cursor-pointer"
                        >
                          ⚡ Activate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email & Password Rows */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 block uppercase font-mono font-semibold">Email</span>
                        <span className="text-slate-200 font-mono text-[11px] truncate block">{emp.email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`email-${idx}`, emp.email)}
                        className="text-[10px] text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="Copy Email"
                      >
                        {copiedKey === `email-${idx}` ? "✓" : "📋"}
                      </button>
                    </div>

                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 block uppercase font-mono font-semibold">Password</span>
                        <span className="text-slate-300 font-mono text-[11px] font-bold tracking-wider block">
                          {showDemoPasswords ? emp.password : "••••••••••••"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`pass-${idx}`, emp.password)}
                        className="text-[10px] text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="Copy Password"
                      >
                        {copiedKey === `pass-${idx}` ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {demoEmpSuccessMsg && (
              <div className="p-3 bg-slate-800/70 border border-slate-700 text-slate-300 text-xs rounded-xl font-medium">
                🎉 {demoEmpSuccessMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const allCreds = demoEmployeesList
                    .map((e) => `• ${e.name}: ${e.email} | Password: ${e.password}`)
                    .join("\n");
                  handleCopyText("all-bulk", allCreds);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline transition cursor-pointer"
              >
                {copiedKey === "all-bulk" ? "✓ All Credentials Copied to Clipboard!" : "📋 Copy All Staff Credentials"}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleDeactivateAllDemoEmployees}
                  disabled={demoEmpLoading}
                  className="px-3 py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 transition disabled:opacity-50 cursor-pointer"
                >
                  Deactivate All
                </button>
                <button
                  type="button"
                  onClick={handleGenerateDemoEmployees}
                  disabled={demoEmpLoading}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-black/10 disabled:opacity-50 cursor-pointer"
                >
                  {demoEmpLoading ? "Updating..." : "⚡ Activate All Staff"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
