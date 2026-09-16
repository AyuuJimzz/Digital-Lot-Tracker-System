import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Crosshair, Pencil, Search, Trash2 } from "lucide-react";

export default function LotCandidateList({
  candidates, issues, activeId, onActivate, onUpdate, onDelete, disabled,
  rowRefs, filterTab, setFilterTab, isEditingShape, onToggleEditShape,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const residentialCount = useMemo(() => candidates.filter((c) => !c.nonSaleable).length, [candidates]);
  const nonSaleableCount = useMemo(() => candidates.filter((c) => c.nonSaleable).length, [candidates]);
  const issuesCount = useMemo(() => candidates.filter((c) => Boolean(c.selected && issues?.get(c.id)?.length)).length, [candidates, issues]);

  const visibleCandidates = useMemo(() => {
    let list = candidates;
    if (filterTab === "residential") list = candidates.filter((c) => !c.nonSaleable);
    else if (filterTab === "nonSaleable") list = candidates.filter((c) => c.nonSaleable);
    else if (filterTab === "issues") list = candidates.filter((c) => Boolean(c.selected && issues?.get(c.id)?.length));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c, idx) =>
        String(c.block || "").toLowerCase().includes(q) ||
        String(c.lotNumber || "").toLowerCase().includes(q) ||
        `candidate ${idx + 1}`.includes(q) ||
        `block ${c.block || ""} lot ${c.lotNumber || ""}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [candidates, filterTab, issues, searchQuery]);

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-100">
      {/* ── Search & Filter Controls ────────────────────────── */}
      <div className="sticky top-0 z-10 space-y-2 border-b border-white/[0.06] bg-[#1e293b] p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search block, lot #, or candidate…"
            className="w-full rounded-md bg-white/[0.04] py-1.5 pl-7 pr-7 text-[11px] text-slate-300 placeholder-slate-600 outline-none transition focus:bg-white/[0.06] focus:ring-1 focus:ring-white/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-600 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              filterTab === "all"
                ? "bg-white/[0.08] text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            All ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("residential")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
              filterTab === "residential"
                ? "bg-white/[0.08] text-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Saleable ({residentialCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("nonSaleable")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
              filterTab === "nonSaleable"
                ? "bg-white/[0.08] text-slate-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Non-saleable ({nonSaleableCount})
          </button>
          {issuesCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab("issues")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                filterTab === "issues"
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-amber-500/70 hover:text-amber-300"
              }`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Needs Correction ({issuesCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Table Column Headers ── */}
      <div className="grid grid-cols-[28px_1fr_1fr_1.1fr_1.7fr_76px] sm:grid-cols-[32px_1.1fr_1.1fr_1.2fr_1.9fr_80px] items-center gap-1.5 border-b border-white/[0.06] bg-[#1e293b] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 shrink-0">
        <span className="text-center">#</span>
        <span>Block</span>
        <span>Lot</span>
        <span>Area</span>
        <span>Type</span>
        <span className="text-right pr-2">Actions</span>
      </div>

      {/* ── Candidate Rows ── */}
      <div className="flex-1 divide-y divide-white/[0.04] overflow-y-auto">
        {visibleCandidates.map((candidate) => {
          const index = candidates.findIndex((c) => c.id === candidate.id);
          const rowIssues = issues.get(candidate.id) || [];
          const isActive = activeId === candidate.id;

          const lotHeading = candidate.block
            ? `Block ${candidate.block} Lot ${candidate.lotNumber || "—"}`
            : (candidate.lotNumber ? `Lot ${candidate.lotNumber}` : `Candidate ${index + 1}`);

          const categoryDisplay = candidate.category
            ? candidate.category.charAt(0).toUpperCase() + candidate.category.slice(1)
            : "";

          return (
            <article
              key={candidate.id}
              tabIndex={-1}
              ref={(element) => { rowRefs.current[candidate.id] = element; }}
              onFocus={() => onActivate(candidate.id, false)}
              className={`group transition-colors ${
                isActive
                  ? "bg-white/[0.06]"
                  : "hover:bg-white/[0.03]"
              }`}
              aria-label={`Candidate ${index + 1}`}
            >
              <span className="sr-only">{lotHeading}</span>
              <div className="grid grid-cols-[28px_1fr_1fr_1.1fr_1.7fr_76px] sm:grid-cols-[32px_1.1fr_1.1fr_1.2fr_1.9fr_80px] items-center gap-1.5 px-3 py-1 text-xs">
                {/* 1. Include Checkbox */}
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={Boolean(candidate.selected)}
                    disabled={disabled}
                    onChange={(event) => onUpdate(candidate.id, { selected: event.target.checked })}
                    className={`h-3.5 w-3.5 rounded cursor-pointer ${
                      candidate.nonSaleable ? "accent-slate-400" : "accent-emerald-500"
                    }`}
                    aria-label={`Include candidate ${index + 1}`}
                  />
                </div>

                {/* 2. Block Input */}
                <div>
                  <input
                    value={candidate.block || ""}
                    maxLength={40}
                    disabled={disabled}
                    placeholder="—"
                    aria-label={`Block for candidate ${index + 1}`}
                    onChange={(event) => onUpdate(candidate.id, { block: event.target.value })}
                    onFocus={() => onActivate(candidate.id, false)}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-slate-200 placeholder-slate-600 outline-none transition hover:border-slate-700 hover:bg-slate-950/60 focus:border-cyan-500 focus:bg-slate-950 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                  />
                </div>

                {/* 3. Lot Input */}
                <div>
                  <input
                    value={candidate.lotNumber || ""}
                    maxLength={50}
                    disabled={disabled}
                    placeholder="—"
                    aria-label={`Lot number for candidate ${index + 1}`}
                    onChange={(event) => onUpdate(candidate.id, { lotNumber: event.target.value })}
                    onFocus={() => onActivate(candidate.id, false)}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-white placeholder-slate-600 outline-none transition hover:border-slate-700 hover:bg-slate-950/60 focus:border-cyan-500 focus:bg-slate-950 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                  />
                </div>

                {/* 4. Area (m²) Input */}
                <div>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={candidate.areaSqm ?? ""}
                    disabled={disabled}
                    placeholder="m²"
                    aria-label={`Area for candidate ${index + 1}`}
                    onChange={(event) => onUpdate(candidate.id, { areaSqm: event.target.value === "" ? null : Number(event.target.value) })}
                    onFocus={() => onActivate(candidate.id, false)}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-mono font-medium text-cyan-300 placeholder-slate-600 outline-none transition hover:border-slate-700 hover:bg-slate-950/60 focus:border-cyan-500 focus:bg-slate-950 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                  />
                </div>

                {/* 5. Type Select */}
                <div className="min-w-0">
                  <select
                    aria-label={`Saleability for candidate ${index + 1}`}
                    disabled={disabled}
                    value={candidate.nonSaleable ? "non-saleable" : "saleable"}
                    onChange={(event) => {
                      setFilterTab("all");
                      onUpdate(candidate.id, { nonSaleable: event.target.value === "non-saleable" });
                    }}
                    onFocus={() => onActivate(candidate.id, false)}
                    className={`w-full truncate rounded border border-transparent bg-transparent px-1 py-1 text-[11px] font-medium outline-none transition hover:border-slate-700 hover:bg-slate-950/60 focus:border-cyan-500 focus:bg-slate-950 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 ${
                      candidate.nonSaleable ? "text-slate-400" : "text-emerald-400"
                    }`}
                  >
                    <option value="saleable" className="bg-slate-900 text-emerald-300">Saleable (Green)</option>
                    <option value="non-saleable" className="bg-slate-900 text-slate-300">Non-Saleable (Slate)</option>
                  </select>
                  {candidate.nonSaleable && (
                    <span className="sr-only">
                      Non-saleable{categoryDisplay ? ` (${categoryDisplay})` : ""}
                    </span>
                  )}
                </div>

                {/* 6. Quick Action Icons */}
                <div className="flex items-center justify-end gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onActivate(candidate.id, true)}
                    aria-label={`Find candidate ${index + 1} on plan`}
                    title="Focus on blueprint map"
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-white/5 hover:text-slate-300 disabled:opacity-40 transition"
                  >
                    <Crosshair className="h-3 w-3" />
                  </button>

                  {onToggleEditShape && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isActive && isEditingShape) {
                          onToggleEditShape(false);
                        } else {
                          onActivate(candidate.id, true);
                          onToggleEditShape(true);
                        }
                      }}
                      aria-label={`Edit shape of candidate ${index + 1}`}
                      title={isActive && isEditingShape ? "Done editing and lock shape" : "Edit polygon corners on blueprint"}
                      className={`flex h-6 items-center gap-1 rounded px-1 text-[10px] font-medium transition ${
                        isActive && isEditingShape
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-slate-600 hover:bg-white/5 hover:text-slate-300"
                      }`}
                    >
                      {isActive && isEditingShape ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Done</span>
                        </>
                      ) : (
                        <Pencil className="h-3 w-3" />
                      )}
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(candidate.id);
                      }}
                      aria-label={`Delete candidate ${index + 1}`}
                      title="Remove candidate"
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Warning */}
              {rowIssues.length > 0 && (
                <div className="space-y-1 border-t border-rose-500/10 bg-rose-500/5 px-3 py-1 text-xs">
                  {rowIssues.map((issue) => {
                    const conflictMatch = issue.match(/conflicts with Candidate (\d+)/);
                    return (
                      <div key={issue} className="flex flex-wrap items-center justify-between gap-1 text-rose-400">
                        <p className="flex items-start gap-1 text-[11px]">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          {issue}
                        </p>
                        {conflictMatch && (
                          <button
                            type="button"
                            onClick={() => onActivate(candidates[Number(conflictMatch[1]) - 1]?.id, false, true)}
                            className="text-[10px] font-medium text-slate-500 hover:text-slate-300 transition"
                          >
                            View Candidate {conflictMatch[1]} →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}

        {visibleCandidates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-600">
            <p className="text-xs">
              {filterTab === "issues" ? "No included lots need corrections." : "No candidates found in this view."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
