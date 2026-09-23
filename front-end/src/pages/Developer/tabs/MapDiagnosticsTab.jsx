import React from "react";

const MapDiagnosticsTab = ({
  mapDiag,
  fetchMapDiagnostics,
  mapDiagLoading,
  setMapDiagFilter,
  mapDiagFilter,
  showFlaggedLotsList,
  setShowFlaggedLotsList,
  handleOpenTableData,
}) => {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-teal-400 flex items-center justify-center text-lg shrink-0">
            🗺️
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Map & Lot Coordinate Diagnostics</h2>
            <p className="text-[11px] text-slate-400">Scan 2D polygon geometries, detect missing lot coordinates, and verify map readiness.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Coverage badge */}
          {mapDiag && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {mapDiag.overallCoveragePct}% Ready ({mapDiag.mappedCount}/{mapDiag.totalLots} Lots)
            </span>
          )}

          {/* Scan / Refresh Button */}
          <button
            onClick={fetchMapDiagnostics}
            disabled={mapDiagLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={mapDiagLoading ? "animate-spin text-teal-400" : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{mapDiagLoading ? "Scanning..." : "Scan & Diagnostics"}</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric 1: Overall Map Coverage */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Map Coverage
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {mapDiag ? `${mapDiag.overallCoveragePct}%` : "--"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {mapDiag ? `${mapDiag.mappedCount} of ${mapDiag.totalLots} Lots Geocoded` : "Scanning..."}
            </div>
          </div>

          {/* Metric 2: Valid Polygons */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Valid Polygons
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {mapDiag?.polygonCount || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Full 2D boundary points
            </div>
          </div>

          {/* Metric 3: Missing Coordinates */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Unmapped Lots
            </div>
            <div className="text-lg font-bold text-slate-200 font-mono">
              {mapDiag?.unmappedCount || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Missing database coordinates
            </div>
          </div>

          {/* Metric 4: Corrupted / Broken */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Geometry Warnings
            </div>
            <div className="text-lg font-bold font-mono text-slate-200">
              {mapDiag?.corruptedCount || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Syntax integrity status
            </div>
          </div>
        </div>

        {/* Subdivision-by-Subdivision Coverage Breakdown */}
        {mapDiag?.propertyBreakdown && mapDiag.propertyBreakdown.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span>📐</span>
              <span>Subdivision Coverage ({mapDiag.propertyBreakdown.length} Properties)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {mapDiag.propertyBreakdown.map((prop) => (
                <div
                  key={prop.propertyId}
                  className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {prop.propertyName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {prop.location || "Location not set"}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300 px-2 py-0.5 bg-slate-800 rounded shrink-0">
                      {prop.coveragePct}%
                    </span>
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        prop.coveragePct === 100
                          ? "bg-emerald-500/80"
                          : prop.coveragePct > 0
                          ? "bg-sky-500/80"
                          : "bg-slate-700"
                      }`}
                      style={{ width: `${Math.max(3, prop.coveragePct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                    <span>{prop.mappedLots} / {prop.totalLots} lots mapped</span>
                    {prop.unmappedLots > 0 && (
                      <span className="text-amber-400">
                        {prop.unmappedLots} unmapped
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flagged / Unmapped Lots Section - Only visible if there are issues */}
        {mapDiag && mapDiag.flaggedLots && mapDiag.flaggedLots.length > 0 && (
          <div className="border-t border-slate-800/80 pt-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Flagged & Unmapped Lots ({mapDiag.flaggedLots.length})
                </h3>
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.2 rounded-full">
                  Action Required
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  onClick={() => setMapDiagFilter("ALL")}
                  className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                    mapDiagFilter === "ALL"
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({mapDiag.flaggedLots.length})
                </button>
                {mapDiag.unmappedCount > 0 && (
                  <button
                    onClick={() => setMapDiagFilter("UNMAPPED")}
                    className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                      mapDiagFilter === "UNMAPPED"
                        ? "bg-amber-500/20 text-amber-400 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Missing ({mapDiag.unmappedCount})
                  </button>
                )}
                {mapDiag.corruptedCount > 0 && (
                  <button
                    onClick={() => setMapDiagFilter("CORRUPTED")}
                    className={`px-2.5 py-0.5 rounded-lg transition font-medium ${
                      mapDiagFilter === "CORRUPTED"
                        ? "bg-rose-500/20 text-rose-400 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Corrupted ({mapDiag.corruptedCount})
                  </button>
                )}
                <button
                  onClick={() => setShowFlaggedLotsList(!showFlaggedLotsList)}
                  className="text-slate-500 hover:text-slate-300 ml-2 text-xs"
                >
                  {showFlaggedLotsList ? "Hide List ▲" : "Show List ▼"}
                </button>
              </div>
            </div>

            {showFlaggedLotsList && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {mapDiag.flaggedLots
                  .filter((lot) => mapDiagFilter === "ALL" || lot.issueType === mapDiagFilter)
                  .map((lot) => (
                    <div
                      key={lot.lotId}
                      className="p-3 bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                          #{lot.lotNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                              {lot.propertyName} • Lot {lot.lotNumber}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {lot.areaSqm ? `${lot.areaSqm} sqm` : "Area not set"}
                            </span>
                            <span className={`text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded uppercase ${
                              lot.status === "AVAILABLE"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                              {lot.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {lot.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          lot.severity === "danger"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}>
                          {lot.issue}
                        </span>
                        <button
                          onClick={() => handleOpenTableData("lots")}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                          title="Inspect in lots table"
                        >
                          Inspect ↗
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapDiagnosticsTab;
