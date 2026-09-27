import React from "react";
import { Database } from "lucide-react";

const DatabaseTab = ({
  dbStats,
  fetchDbStats,
  dbStatsLoading,
  handleOpenTableData,
}) => {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
            <Database size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Database & storage</h2>
            <p className="text-xs text-slate-400">Table records, storage, and connection latency.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Latency badge */}
          {dbStats && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {dbStats.latencyMs}ms ({dbStats.status})
            </span>
          )}

          {/* Ping & Refresh Button */}
          <button
            onClick={fetchDbStats}
            disabled={dbStatsLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={dbStatsLoading ? "animate-spin text-slate-300" : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{dbStatsLoading ? "Pinging..." : "Refresh"}</span>
          </button>

        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric 1: Ping / Latency */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Cloud Latency
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {dbStats ? `${dbStats.latencyMs} ms` : "--"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {dbStats ? `Status: ${dbStats.status}` : "Direct Query Ping"}
            </div>
          </div>

          {/* Metric 2: Database Storage Size */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Database Storage
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {dbStats?.totalSizeFormatted || "0 KB"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {dbStats?.totalBytes ? `${dbStats.totalBytes.toLocaleString()} bytes` : "Storage usage"}
            </div>
          </div>

          {/* Metric 3: Total Tables */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Managed Tables
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {dbStats?.tableCount || 0} Tables
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
              Schema: {dbStats?.databaseName || "golden_dragon_corp"}
            </div>
          </div>

          {/* Metric 4: Total Records Count */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Total Records
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {dbStats?.totalRows ? dbStats.totalRows.toLocaleString() : 0} Rows
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Active database records
            </div>
          </div>
        </div>

        {/* Table-by-Table Breakdown Grid */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span>🗂️</span>
              <span>Database Tables ({dbStats?.tables?.length || 0})</span>
            </div>
            <span className="text-[10px] text-slate-500">Click any card to inspect rows</span>
          </div>

          {dbStatsLoading && !dbStats ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              Inspecting database tables and storage...
            </div>
          ) : !dbStats?.tables || dbStats.tables.length === 0 ? (
            <div className="p-6 text-center text-slate-500 italic text-xs">
              No tables found in current database schema.
            </div>
          ) : (
            (() => {
              const maxBytes = Math.max(...dbStats.tables.map((t) => t.totalBytes || 1), 1);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dbStats.tables.map((tbl) => {
                    const pctOfLargest = Math.max(4, Math.round((tbl.totalBytes / maxBytes) * 100));

                    return (
                      <div
                        key={tbl.name}
                        onClick={() => handleOpenTableData(tbl.name)}
                        className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-lg transition flex flex-col justify-between gap-2.5 group cursor-pointer"
                        title={`Click to inspect records in '${tbl.name}'`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-7 h-7 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center text-xs shrink-0">
                                📄
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition">
                                  {tbl.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Table Schema
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-300 px-1.5 py-0.5 bg-slate-800 rounded shrink-0">
                              {tbl.sizeFormatted}
                            </span>
                          </div>

                          {/* Relative Footprint Visual Bar */}
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-500/80 rounded-full transition-all duration-500"
                              style={{ width: `${pctOfLargest}%` }}
                            />
                          </div>
                        </div>

                        {/* Table Record & Size Details */}
                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-400">
                          <span>{tbl.rows.toLocaleString()} rows</span>
                          <span className="text-slate-300 group-hover:text-white transition">
                            View Data ↗
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseTab;
