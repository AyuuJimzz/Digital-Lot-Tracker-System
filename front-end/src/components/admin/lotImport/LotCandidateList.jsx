import React, { useMemo } from "react";
import { AlertTriangle, Crosshair } from "lucide-react";

const inputClass = "w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 disabled:opacity-50";

const BADGE_CONFIG = {
  park: {
    label: "Non-saleable (Park)",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    borderActive: "border-purple-400/80 bg-purple-950/30",
    accentText: "text-purple-300",
  },
  facility: {
    label: "Non-saleable (Facility)",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    borderActive: "border-purple-400/80 bg-purple-950/30",
    accentText: "text-purple-300",
  },
  excluded: {
    label: "Non-saleable (Excluded)",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    borderActive: "border-purple-400/80 bg-purple-950/30",
    accentText: "text-purple-300",
  },
  open_space: {
    label: "Non-saleable (Open Space)",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    borderActive: "border-purple-400/80 bg-purple-950/30",
    accentText: "text-purple-300",
  },
};

export default function LotCandidateList({ candidates, issues, activeId, onActivate, onUpdate, disabled, rowRefs, filterTab, setFilterTab }) {

  const residentialCount = useMemo(() => candidates.filter((c) => !c.nonSaleable).length, [candidates]);
  const nonSaleableCount = useMemo(() => candidates.filter((c) => c.nonSaleable).length, [candidates]);
  const issuesCount = useMemo(() => candidates.filter((c) => Boolean(c.selected && issues?.get(c.id)?.length)).length, [candidates, issues]);

  const visibleCandidates = useMemo(() => {
    if (filterTab === "residential") return candidates.filter((c) => !c.nonSaleable);
    if (filterTab === "nonSaleable") return candidates.filter((c) => c.nonSaleable);
    if (filterTab === "issues") return candidates.filter((c) => Boolean(c.selected && issues?.get(c.id)?.length));
    return candidates;
  }, [candidates, filterTab, issues]);

  return (
    <div className="space-y-3 p-4">
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${filterTab === "all" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            All ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("residential")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${filterTab === "residential" ? "bg-emerald-900/60 text-emerald-300 shadow-sm border border-emerald-700/50" : "text-slate-400 hover:text-slate-200"}`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
            Saleable ({residentialCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("nonSaleable")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${filterTab === "nonSaleable" ? "bg-purple-900/60 text-purple-300 shadow-sm border border-purple-700/50" : "text-slate-400 hover:text-slate-200"}`}
          >
            <span className="h-2 w-2 rounded-full bg-purple-400 inline-block" />
            Non-saleable ({nonSaleableCount})
          </button>
          {issuesCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab("issues")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${filterTab === "issues" ? "bg-amber-500/30 text-amber-200 shadow-sm border border-amber-500/50" : "text-amber-400/90 hover:text-amber-200"}`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              Needs Correction ({issuesCount})
            </button>
          )}
        </div>
      )}

      {visibleCandidates.map((candidate) => {
        const index = candidates.findIndex((c) => c.id === candidate.id);
        const rowIssues = issues.get(candidate.id) || [];
        const warnings = (candidate.warnings || []).filter((warning) => !candidate.detectedClassification || !/^Non-saleable area\s*\(/i.test(warning));
        const badge = candidate.nonSaleable ? (BADGE_CONFIG[candidate.category] || BADGE_CONFIG.excluded) : null;
        const activeBorder = badge?.borderActive || "border-emerald-400/80 bg-emerald-950/30";

        return (
          <article
            key={candidate.id}
            tabIndex={-1}
            ref={(element) => { rowRefs.current[candidate.id] = element; }}
            onFocus={() => onActivate(candidate.id, false)}
            className={`rounded-xl border p-3 transition-colors ${activeId === candidate.id ? activeBorder : "border-slate-700 bg-slate-800/50"}`}
            aria-label={`Candidate ${index + 1}`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-white">
                  <input type="checkbox" checked={Boolean(candidate.selected)} disabled={disabled}
                    onChange={(event) => onUpdate(candidate.id, { selected: event.target.checked })}
                    className={`h-4 w-4 ${candidate.nonSaleable ? "accent-purple-500" : "accent-emerald-500"}`} aria-label={`Include candidate ${index + 1}`} />
                  <span>Candidate {index + 1}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${candidate.selected ? (candidate.nonSaleable ? "bg-purple-400/15 text-purple-300" : "bg-emerald-400/15 text-emerald-300") : "bg-slate-700 text-slate-300"}`}>
                    {candidate.selected ? "Included" : "Excluded"}
                  </span>
                </label>
                {badge && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <button type="button" disabled={disabled} onClick={() => onActivate(candidate.id, true)}
                aria-label={`Find candidate ${index + 1} on plan`} title="Focus this boundary"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${badge?.accentText || "text-emerald-300"} hover:bg-slate-700 disabled:opacity-50`}>
                <Crosshair className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-3 block space-y-1 text-xs text-slate-300">Saleability
              <select aria-label={`Saleability for candidate ${index + 1}`} disabled={disabled}
                value={candidate.nonSaleable ? "non-saleable" : "saleable"} className={`${inputClass} min-h-11`}
                onChange={(event) => {
                  setFilterTab("all");
                  onUpdate(candidate.id, { nonSaleable: event.target.value === "non-saleable" });
                }}>
                <option value="saleable">Saleable — Green</option>
                <option value="non-saleable">Non-saleable — Violet</option>
              </select>
            </label>
            {candidate.detectedClassification && <p className="mb-3 text-xs leading-relaxed text-slate-400">
              Classification set manually. Originally detected as {candidate.detectedClassification.nonSaleable ? "non-saleable" : "saleable"}.
            </p>}
            <div className="grid grid-cols-3 gap-2">
              <label className="min-w-0 space-y-1 text-xs text-slate-300">Block
                <input value={candidate.block || ""} maxLength={40} disabled={disabled} className={inputClass}
                  aria-label={`Block for candidate ${index + 1}`} placeholder="Optional"
                  onChange={(event) => onUpdate(candidate.id, { block: event.target.value })} />
              </label>
              <label className="min-w-0 space-y-1 text-xs text-slate-300">Lot number
                <input value={candidate.lotNumber || ""} maxLength={50} disabled={disabled} className={inputClass}
                  aria-label={`Lot number for candidate ${index + 1}`}
                  onChange={(event) => onUpdate(candidate.id, { lotNumber: event.target.value })} />
              </label>
              <label className="min-w-0 space-y-1 text-xs text-slate-300">Area (m²)
                <input type="number" min="0.01" step="any" value={candidate.areaSqm ?? ""} disabled={disabled} className={inputClass}
                  aria-label={`Area for candidate ${index + 1}`}
                  onChange={(event) => onUpdate(candidate.id, { areaSqm: event.target.value === "" ? null : Number(event.target.value) })} />
              </label>
            </div>
            {(rowIssues.length > 0 || warnings.length > 0) && (
              <div className="mt-3 space-y-1 text-xs leading-relaxed">
                {rowIssues.map((issue) => {
                  const conflictMatch = issue.match(/conflicts with Candidate (\d+)/);
                  return (
                    <div key={issue} className="flex flex-wrap items-center justify-between gap-1.5 text-rose-300">
                      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{issue}</p>
                      {conflictMatch && (
                        <button type="button" onClick={() => onActivate(candidates[Number(conflictMatch[1]) - 1]?.id, false, true)}
                          className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/30">
                          View Candidate {conflictMatch[1]} →
                        </button>
                      )}
                    </div>
                  );
                })}
                {warnings.map((warning, warningIndex) => <p key={`${warningIndex}-${warning}`} className="text-amber-200/90">{warning}</p>)}
              </div>
            )}
          </article>
        );
      })}
      {visibleCandidates.length === 0 && <p className="py-4 text-sm text-slate-400">
        {filterTab === "issues" ? "No included lots need corrections." : "No candidates in this category."}
      </p>}
    </div>
  );
}
