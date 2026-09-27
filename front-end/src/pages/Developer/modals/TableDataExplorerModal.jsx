import React from "react";

// Helper to get table icon and badge color
export const getTableIcon = (tableName) => {
  const t = (tableName || "").toLowerCase();
  if (t.includes("propert")) return { icon: "🏡", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("lot")) return { icon: "📍", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("customer") || t.includes("user")) return { icon: "👥", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("transaction") || t.includes("payment")) return { icon: "💳", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("receipt")) return { icon: "🧾", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("employee") || t.includes("staff")) return { icon: "👔", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("admin")) return { icon: "🛡️", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  if (t.includes("inquir") || t.includes("message")) return { icon: "💬", color: "bg-slate-800/70 text-slate-300 border-slate-700" };
  return { icon: "🗄️", color: "bg-slate-800 text-slate-300 border-slate-700" };
};

// Helper to format table explorer cell values cleanly with rich pills, dates, and badges
export const renderTableExplorerCell = (col, val) => {
  if (val === null || val === undefined || val === "") {
    return <span className="text-slate-600 font-mono text-xs select-none pl-1">—</span>;
  }

  const colName = (col.name || "").toLowerCase();
  const valStr = String(val);

  // Booleans
  if (typeof val === "boolean" || (col.type === "tinyint" && (val === 0 || val === 1) && (colName.includes("is_") || colName.includes("has_") || colName.includes("required")))) {
    const isTrue = val === true || val === 1;
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono border ${
        isTrue ? "bg-slate-800/70 text-slate-300 border-slate-700" : "bg-slate-800 text-slate-400 border-slate-700"
      }`}>
        {isTrue ? "TRUE" : "FALSE"}
      </span>
    );
  }

  // Passwords (already masked from backend)
  if (colName.includes("password")) {
    return (
      <span className="font-mono text-xs text-slate-300 font-medium tracking-wider">
        •••••••• <span className="text-[9px] text-slate-500 font-normal">[Bcrypt]</span>
      </span>
    );
  }

  // Status, Roles & Payment Types
  if (colName.includes("status") || colName.includes("payment_type") || colName.includes("role") || colName.includes("gender")) {
    let badgeStyle = "bg-slate-900 text-slate-300 border-slate-800";
    const lower = valStr.toLowerCase();
    if (lower === "available" || lower === "cash" || lower === "admin" || lower === "active" || lower === "paid") {
      badgeStyle = "bg-slate-900 text-slate-300 border-slate-700";
    } else if (lower === "reserved" || lower === "installment" || lower === "employee") {
      badgeStyle = "bg-slate-900 text-slate-300 border-slate-700";
    } else if (lower === "sold" || lower === "no downpayment" || lower === "pending") {
      badgeStyle = "bg-slate-900 text-slate-300 border-slate-700";
    } else if (lower === "cancelled" || lower === "inactive" || lower === "failed") {
      badgeStyle = "bg-slate-900 text-rose-300 border-rose-500/30";
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border capitalize font-sans ${badgeStyle}`}>
        {valStr}
      </span>
    );
  }

  // Primary Keys & Foreign Keys (#ID badges)
  if (col.isPrimary || colName.endsWith("_id") || colName === "id") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800/80 text-slate-300 font-mono text-[11px]">
        #{valStr}
      </span>
    );
  }

  // Price, Amount & Currency
  if (colName.includes("price") || colName.includes("amount") || colName.includes("balance") || colName.includes("payment") || colName.includes("cost")) {
    const num = Number(val);
    if (!isNaN(num)) {
      return (
        <span className="font-mono text-slate-200 font-medium text-xs">
          ₱{num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
  }

  // Area (sqm)
  if (colName.includes("area") || colName.includes("sqm")) {
    return (
      <span className="font-mono text-slate-200 font-medium text-xs">
        {valStr} <span className="text-[10px] text-slate-500">sqm</span>
      </span>
    );
  }

  // Email
  if (colName.includes("email")) {
    return (
      <span className="text-slate-300 font-mono text-xs" title={valStr}>
        {valStr}
      </span>
    );
  }

  // Dates & Timestamps
  if (colName.includes("date") || colName.includes("time") || colName.includes("created_at") || colName.includes("updated_at") || colName.includes("dob")) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const dateFormatted = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeFormatted = d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return (
          <span className="text-slate-300 text-xs whitespace-nowrap" title={valStr}>
            <span className="text-slate-200">{dateFormatted}</span>
            <span className="text-slate-500 text-[10px] ml-1.5 font-mono">· {timeFormatted}</span>
          </span>
        );
      }
    } catch (e) {}
  }

  // Coordinates GeoJSON
  if (colName.includes("coordinate") || colName.includes("geometry") || colName.includes("polygon")) {
    return (
      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded" title={valStr}>
        🗺️ GeoJSON
      </span>
    );
  }

  // Default Text
  return (
    <span className="text-slate-300 text-xs font-sans max-w-sm truncate block" title={valStr}>
      {valStr}
    </span>
  );
};

export default function TableDataExplorerModal({
  selectedTable,
  setSelectedTable,
  tableData,
  setTableData,
  tableDataLoading,
  tableSearchQuery,
  setTableSearchQuery,
  handleDownloadTableJson,
  rowToDelete,
  setRowToDelete,
  rowDeleteLoading,
  handleDeleteRowConfirm,
}) {
  if (!selectedTable) return null;

  const handleClose = () => {
    setSelectedTable(null);
    setTableData(null);
    setTableSearchQuery("");
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
        <div className="bg-slate-950 border border-slate-800/90 w-[96vw] max-w-[1750px] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
          {/* Modal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/95 px-6 py-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border shrink-0 shadow-sm ${getTableIcon(selectedTable).color}`}>
                {getTableIcon(selectedTable).icon}
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {selectedTable}
                  </h3>
                  <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/70 text-slate-300 border border-slate-700">
                    {tableData ? `${tableData.totalRows.toLocaleString()} Records` : "Loading..."}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Live database rows extracted directly from Aiven Cloud MySQL</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
              {/* Search Query Input */}
              {tableData && tableData.rows && tableData.rows.length > 0 && (
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="12" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Filter rows..."
                    className="text-xs pl-8 pr-7 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl focus:border-slate-700 focus:ring-1 focus:ring-slate-400 outline-none text-slate-200 placeholder-slate-500 w-48 sm:w-64 transition"
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Export JSON Button */}
              {tableData && tableData.rows && tableData.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadTableJson(selectedTable, tableData.rows)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Download rows as JSON"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export JSON
                </button>
              )}

              {/* Close Modal Button */}
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Body: Spacious & Scrollable Studio Table */}
          <div className="flex-1 overflow-auto bg-[#070b14] p-4 sm:p-6">
            {tableDataLoading ? (
              <div className="flex flex-col items-center justify-center py-28 text-slate-500 gap-3">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="animate-spin text-slate-300">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span className="text-xs font-mono text-slate-400">Loading records from '{selectedTable}'...</span>
              </div>
            ) : !tableData || !tableData.rows || tableData.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500 italic text-xs border border-dashed border-slate-800 rounded-2xl">
                No records found in '{selectedTable}' table.
              </div>
            ) : (
              (() => {
                const filteredRows = tableData.rows.filter((row) => {
                  if (!tableSearchQuery.trim()) return true;
                  const q = tableSearchQuery.toLowerCase();
                  return Object.values(row).some((val) =>
                    val !== null && val !== undefined && val.toString().toLowerCase().includes(q)
                  );
                });

                if (filteredRows.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 italic text-xs bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                      <span>No rows match '{tableSearchQuery}'.</span>
                      <button
                        type="button"
                        onClick={() => setTableSearchQuery("")}
                        className="mt-2 text-xs text-slate-300 hover:underline cursor-pointer"
                      >
                        Clear search filter
                      </button>
                    </div>
                  );
                }

                const primaryKeyCol = tableData.columns.find((c) => c.isPrimary) || tableData.columns[0];

                return (
                  <div className="border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl bg-slate-950/60 w-full">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full min-w-max text-left border-collapse text-xs">
                        {/* Clean Table Header */}
                        <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400">
                          <tr>
                            <th className="py-3 px-4 font-mono text-[11px] text-slate-500 w-12 text-center select-none min-w-[48px]">
                              #
                            </th>
                            {tableData.columns.map((col) => (
                              <th
                                key={col.name}
                                className="py-3 px-5 font-semibold text-slate-300 whitespace-nowrap min-w-[150px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  {col.isPrimary && (
                                    <span title="Primary Key" className="text-slate-300 text-xs">🔑</span>
                                  )}
                                  <span className="font-semibold text-slate-200 tracking-tight text-xs">{col.name}</span>
                                </div>
                              </th>
                            ))}
                            <th className="py-3 px-4 font-semibold text-slate-400 text-center w-16 min-w-[70px] sticky right-0 bg-slate-900/95 border-l border-slate-800 select-none">
                              Action
                            </th>
                          </tr>
                        </thead>

                        {/* Clean Rows */}
                        <tbody className="divide-y divide-slate-800/40 text-xs">
                          {filteredRows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="hover:bg-slate-900/30 transition-colors group"
                            >
                              <td className="py-3 px-4 text-slate-500 text-center font-mono text-[11px] select-none">
                                {rowIdx + 1}
                              </td>
                              {tableData.columns.map((col) => {
                                const val = row[col.name];
                                return (
                                  <td
                                    key={col.name}
                                    className="py-3 px-5 text-slate-300 align-middle whitespace-nowrap min-w-[150px]"
                                  >
                                    {renderTableExplorerCell(col, val)}
                                  </td>
                                );
                              })}
                              {/* Row Action: Delete */}
                              <td className="py-3 px-4 text-center sticky right-0 bg-slate-950/95 border-l border-slate-800/60 min-w-[70px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const pkVal = row[primaryKeyCol.name];
                                    const label = row.full_name || row.email || row.lot_number || `ID #${pkVal}`;
                                    setRowToDelete({
                                      tableName: selectedTable,
                                      primaryKey: primaryKeyCol.name,
                                      primaryKeyValue: pkVal,
                                      rowSummary: `${primaryKeyCol.name} #${pkVal} (${label})`,
                                    });
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer"
                                  title={`Delete record #${row[primaryKeyCol.name]} from ${selectedTable}`}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-950/95 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-300 font-semibold">
                {tableData ? `${tableData.rows?.length || 0} rows` : ""}
              </span>
              {tableSearchQuery && (
                <span className="text-slate-300 font-mono text-[11px]">
                  (Filtered query active)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition shadow-sm cursor-pointer"
            >
              Close Explorer
            </button>
          </div>
        </div>
      </div>

      {/* ──────── SINGLE ROW DELETE CONFIRMATION MODAL ──────── */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Table Record</h3>
                <p className="text-xs text-slate-400">Permanently delete record from database</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Target Table:</span>
                <span className="font-mono text-white font-bold">{rowToDelete.tableName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Record:</span>
                <span className="font-mono text-rose-400 font-semibold">{rowToDelete.rowSummary}</span>
              </div>
            </div>

            {rowToDelete.tableName && rowToDelete.tableName.toLowerCase() === "customers" && (
              <div className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl text-[11px] text-slate-300">
                ⚠️ Deleting this customer will also delete their related transactions in the transaction history and reset lot status if applicable.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                disabled={rowDeleteLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRowConfirm}
                disabled={rowDeleteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {rowDeleteLoading ? "Deleting Record..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
