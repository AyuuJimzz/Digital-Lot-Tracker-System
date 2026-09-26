import React from "react";

const EnvHealthTab = ({
  envHealthData,
  fetchEnvHealth,
  envHealthLoading,
  envCategoryFilter,
  setEnvCategoryFilter,
}) => {
  const configuredRequired =
    envHealthData?.configuredRequired ??
    envHealthData?.variables?.filter((v) => v.required && v.isSet)?.length ??
    0;
  const totalRequired =
    envHealthData?.totalRequired ??
    envHealthData?.variables?.filter((v) => v.required)?.length ??
    0;
  const allRequiredSet =
    envHealthData?.allRequiredSet !== undefined
      ? Boolean(envHealthData.allRequiredSet)
      : (configuredRequired === totalRequired && totalRequired > 0);
  const configuredCount =
    envHealthData?.configuredCount ??
    envHealthData?.variables?.filter((v) => v.isSet)?.length ??
    0;
  const totalCount =
    envHealthData?.totalCount ??
    envHealthData?.totalVariables ??
    envHealthData?.variables?.length ??
    0;

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Environment Variables (.env) Health Inspector
            </h2>
            <p className="text-xs text-slate-400">
              Audit backend deployment environment variables, verify required keys, and safely inspect masked configurations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Status Badge */}
          {envHealthData && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
              allRequiredSet
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${allRequiredSet ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
              {allRequiredSet ? "🟢 All Required Configs Set" : "⚠️ Missing Required Variables"}
            </span>
          )}

          {/* Rescan Button */}
          <button
            onClick={fetchEnvHealth}
            disabled={envHealthLoading}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={envHealthLoading ? "animate-spin text-amber-400" : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {envHealthLoading ? "Auditing..." : "Re-check .env"}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 4 Hero KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Required Variables
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {`${configuredRequired} / ${totalRequired}`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Core keys satisfied</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Total Configured
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {`${configuredCount} / ${totalCount}`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">System & optional configs</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Secret Masking
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              Active
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Zero plain text exposure</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Target Cloud
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              Render & Aiven
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Production Ready</div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "Database", "Security", "Server", "Notifications"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setEnvCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                envCategoryFilter === cat
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Environment Variables Table */}
        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold min-w-[200px]">Variable</th>
                  <th className="py-3 px-4 font-semibold min-w-[220px]">Description</th>
                  <th className="py-3 px-4 font-semibold min-w-[120px] text-center">Status</th>
                  <th className="py-3 px-4 font-semibold min-w-[180px] text-right font-mono">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {envHealthLoading && !envHealthData ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 font-mono text-xs">
                      Auditing backend environment variables...
                    </td>
                  </tr>
                ) : !envHealthData || !envHealthData.variables || envHealthData.variables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 italic text-xs">
                      Click "Re-check .env" to inspect environment keys.
                    </td>
                  </tr>
                ) : (
                  envHealthData.variables
                    .filter((v) => envCategoryFilter === "ALL" || v.category === envCategoryFilter)
                    .map((v, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Key & Required Badge */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200">{v.key}</span>
                            {v.required && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                                req
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {v.description}
                        </td>

                        {/* Status Dot */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              v.status === "CONFIGURED"
                                ? "bg-emerald-400"
                                : v.status === "USING_DEFAULT"
                                ? "bg-sky-400"
                                : v.status === "MISSING_REQUIRED"
                                ? "bg-rose-500"
                                : "bg-slate-600"
                            }`} />
                            <span>
                              {v.status === "CONFIGURED"
                                ? "Set"
                                : v.status === "USING_DEFAULT"
                                ? "Default"
                                : v.status === "MISSING_REQUIRED"
                                ? "Missing"
                                : "Unset"}
                            </span>
                          </span>
                        </td>

                        {/* Masked Value */}
                        <td className="py-3 px-4 text-right font-mono text-[11px]">
                          {v.displayValue ? (
                            <span className="text-slate-300">
                              {v.displayValue}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">Unset</span>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvHealthTab;
