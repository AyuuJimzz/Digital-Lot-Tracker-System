import React from "react";

const EndpointsTab = ({
  apiHealthData,
  fetchApiHealth,
  apiHealthLoading,
  apiDomainFilter,
  setApiDomainFilter,
}) => {
  const endpointsList = apiHealthData?.endpoints || apiHealthData?.routes || [];
  const totalEndpoints = apiHealthData?.totalEndpoints ?? apiHealthData?.totalCount ?? endpointsList.length;
  const healthyCount = apiHealthData?.healthyCount ?? endpointsList.filter(ep => ep.isHealthy || ep.status?.includes("200") || ep.status === "HEALTHY").length;
  const availabilityPercent = totalEndpoints > 0 ? Math.round((healthyCount / totalEndpoints) * 100) : 100;

  const avgLatencyMs = apiHealthData?.avgLatencyMs ?? (
    endpointsList.length > 0
      ? Math.round(endpointsList.reduce((acc, ep) => acc + (ep.latencyMs || 0), 0) / endpointsList.length)
      : 0
  );

  const rawTimestamp = apiHealthData?.timestamp || apiHealthData?.scannedAt;
  const formattedLastChecked = rawTimestamp && !isNaN(new Date(rawTimestamp).getTime())
    ? new Date(rawTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Just now";

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">API health</h2>
            <p className="text-xs text-slate-400">
              Route availability, response codes, and latency.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Status Badge */}
          {apiHealthData && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800/70 text-slate-300 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
              {healthyCount}/{totalEndpoints || endpointsList.length || 11} operational
            </span>
          )}

          {/* Rescan Button */}
          <button
            onClick={fetchApiHealth}
            disabled={apiHealthLoading}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={apiHealthLoading ? "animate-spin text-slate-300" : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {apiHealthLoading ? "Testing Endpoints..." : "Scan Endpoints"}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 4 Hero KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              System Availability
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {apiHealthData ? `${availabilityPercent}%` : "--"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {apiHealthData ? `${healthyCount} of ${totalEndpoints} routes active` : "Awaiting health check"}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Average Latency
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {apiHealthData ? `${avgLatencyMs} ms` : "—"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Optimal response time
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Monitored Routes
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {totalEndpoints ? `${totalEndpoints} Endpoints` : `${endpointsList.length || 11} Endpoints`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Public, Admin, & DB APIs
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Last Checked
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {formattedLastChecked}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Auto-verified live
            </div>
          </div>
        </div>

        {/* Domain Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "Public / Map", "Transactions", "Analytics", "Developer Core", "Infrastructure"].map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setApiDomainFilter(dom)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                apiDomainFilter === dom
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>

        {/* Endpoints Table Matrix */}
        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold w-16 text-center">Method</th>
                  <th className="py-3 px-4 font-semibold min-w-[180px]">Endpoint Path</th>
                  <th className="py-3 px-4 font-semibold min-w-[200px]">Name & Purpose</th>
                  <th className="py-3 px-4 font-semibold min-w-[110px]">Domain</th>
                  <th className="py-3 px-4 font-semibold text-center min-w-[80px]">Status</th>
                  <th className="py-3 px-4 font-semibold text-center min-w-[90px]">Latency</th>
                  <th className="py-3 px-4 font-semibold text-right min-w-[80px]">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {apiHealthLoading && !apiHealthData ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                      Scanning and verifying platform endpoints...
                    </td>
                  </tr>
                ) : endpointsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 italic text-xs">
                      Click "Scan Endpoints" to test backend routes.
                    </td>
                  </tr>
                ) : (
                  endpointsList
                    .filter((ep) => apiDomainFilter === "ALL" || ep.domain === apiDomainFilter)
                    .map((ep, idx) => {
                      const isHealthy = ep.isHealthy ?? (ep.status?.includes("200") || ep.status === "HEALTHY" || ep.statusCode === 200);
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-900/40 transition-colors"
                        >
                          {/* Method */}
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              ep.method === "GET"
                                ? "bg-slate-800 text-slate-300 border border-slate-700"
                                : ep.method === "POST"
                                ? "bg-slate-800 text-slate-300 border border-slate-700"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}>
                              {ep.method}
                            </span>
                          </td>

                          {/* Path */}
                          <td className="py-3 px-4 font-mono text-slate-200">
                            {ep.path}
                          </td>

                          {/* Name & Purpose */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{ep.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{ep.description}</div>
                          </td>

                          {/* Domain */}
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {ep.domain}
                          </td>

                          {/* HTTP Status */}
                          <td className="py-3 px-4 text-center">
                            <span className="text-[11px] font-mono text-slate-300">
                              {ep.status}
                            </span>
                          </td>

                          {/* Latency */}
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                            {ep.latencyMs ?? 0} ms
                          </td>

                          {/* Health */}
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                              <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-slate-400" : "bg-rose-500"}`} />
                              <span>{isHealthy ? "Healthy" : "Failed"}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EndpointsTab;
