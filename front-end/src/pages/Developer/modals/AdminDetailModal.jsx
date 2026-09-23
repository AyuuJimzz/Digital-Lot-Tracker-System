import React from "react";

export default function AdminDetailModal({
  selectedAdmin,
  setSelectedAdmin,
  isEditingAdmin,
  setIsEditingAdmin,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleStartEdit,
  editFullName,
  setEditFullName,
  editEmail,
  setEditEmail,
  editLoading,
  editMsg,
  setEditMsg,
  handleSaveEditAdmin,
  deleteLoading,
  handleDeleteAdmin,
  copiedEmail,
  setCopiedEmail,
  resetPasswordVal,
  setResetPasswordVal,
  showResetPassword,
  setShowResetPassword,
  resetLoading,
  resetMsg,
  setResetMsg,
  handleResetAdminPassword,
}) {
  if (!selectedAdmin) return null;

  const handleClose = () => {
    setSelectedAdmin(null);
    setIsEditingAdmin(false);
    setShowDeleteConfirm(false);
    setResetPasswordVal("");
    setResetMsg({ text: "", isError: false });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center bg-slate-950/90 px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            {isEditingAdmin ? "Edit Admin Account" : "Admin Account Details"}
          </div>

          <div className="flex items-center gap-2">
            {!isEditingAdmin && !showDeleteConfirm && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartEdit(selectedAdmin)}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-sm cursor-pointer"
                  title="Edit Full Name or Email"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5 font-medium cursor-pointer"
                  title="Delete Admin Account"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ── DELETE CONFIRMATION BANNER ── */}
          {showDeleteConfirm && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Confirm Permanent Deletion
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-bold">{selectedAdmin.full_name || selectedAdmin.email}</span> (ID #{selectedAdmin.admin_id})? This will remove administrator access immediately.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteAdmin}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? "Deleting..." : "Yes, Delete Admin"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── EDIT MODE FORM ── */}
          {isEditingAdmin ? (
            <form onSubmit={handleSaveEditAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  autoComplete="off"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="admin@goldendragon.com"
                  autoComplete="off"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500"
                />
              </div>

              {editMsg.text && (
                <div className={`text-xs font-medium p-2.5 rounded-xl border ${editMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                  {editMsg.text}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? "Saving Changes..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingAdmin(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Admin Header Card */}
              <div className="flex items-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="w-13 h-13 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                  {(selectedAdmin.full_name || "A").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-white truncate">{selectedAdmin.full_name || "System Administrator"}</h4>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Role: Admin
                  </span>
                </div>
              </div>

              {/* Details Rows */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Database Admin ID</span>
                  <span className="font-mono text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    #{selectedAdmin.admin_id}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Full Name</span>
                  <span className="text-slate-200 font-medium">{selectedAdmin.full_name || "N/A"}</span>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Email Address</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-200 font-medium">{selectedAdmin.email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedAdmin.email);
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
                    >
                      {copiedEmail ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Developer Password Reset Section */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Set New Password
                  </span>
                  <span className="text-[10px] text-slate-500">Developer Override</span>
                </div>

                <form onSubmit={handleResetAdminPassword} className="space-y-2.5">
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      placeholder="Enter new password (min 6 chars)"
                      autoComplete="new-password"
                      className="w-full text-xs px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-white placeholder-slate-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {showResetPassword ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {resetMsg.text && (
                    <div className={`text-xs font-medium p-2 rounded-lg border ${resetMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                      {resetMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading || !resetPasswordVal.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 disabled:opacity-40 cursor-pointer"
                  >
                    {resetLoading ? "Updating Password..." : "Update Password"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950/90 px-6 py-3.5 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
