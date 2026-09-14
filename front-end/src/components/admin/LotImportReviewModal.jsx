import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Layers, Loader2, RotateCcw, X } from "lucide-react";
import LotCandidateList from "./lotImport/LotCandidateList";
import LotPlanPreview from "./lotImport/LotPlanPreview";
import { getCandidateIssues } from "./lotImport/reviewValidation";
import { changeCandidateClassification } from "./lotImport/candidateClassification";

export function LotImportReviewModal({
  candidates = [], onCandidatesChange, onClose, onImport, isImporting = false,
  error, sourceName, existingLotNumbers = [], imageUrl, pageWidth, pageHeight, warnings = [],
}) {
  const dialogRef = useRef(null);
  const previewRef = useRef(null);
  const rowRefs = useRef({});
  const submitLock = useRef(false);
  const originalBoundaries = useRef(new Map(candidates.map((candidate) => [candidate.id, candidate.points.map((point) => [...point])])));
  const [activeId, setActiveId] = useState(candidates[0]?.id);
  const [focusRequest, setFocusRequest] = useState(null);
  const [rowRequest, setRowRequest] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const issues = useMemo(() => getCandidateIssues(candidates, existingLotNumbers), [candidates, existingLotNumbers]);
  const selected = candidates.filter((candidate) => candidate.selected);
  const invalidSelectedCandidates = useMemo(
    () => selected.filter((candidate) => Boolean(issues.get(candidate.id)?.length)),
    [selected, issues],
  );
  const invalidCount = invalidSelectedCandidates.length;
  const validCandidatesCount = useMemo(() => candidates.filter((candidate) => !issues.get(candidate.id)?.length).length, [candidates, issues]);
  const hasDuplicateSelected = useMemo(() => {
    const counts = new Map();
    for (const candidate of candidates) {
      if (candidate.selected) {
        const id = `${candidate.block || ""}:${candidate.lotNumber || ""}`.trim().toLowerCase();
        counts.set(id, (counts.get(id) || 0) + 1);
        if (counts.get(id) > 1) return true;
      }
    }
    return false;
  }, [candidates]);
  const canImport = selected.length > 0 && invalidCount === 0 && confirmed && !isImporting;
  const buttonClass = "min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!rowRequest) return;
    // Wait for the cleared filter to render the destination before scrolling.
    const row = rowRefs.current[rowRequest.id];
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [rowRequest]);

  const handleDialogKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!isImporting) onClose();
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  const updateCandidates = (nextCandidates) => {
    if (isImporting) return;
    setConfirmed(false);
    setSubmitError("");
    onCandidatesChange(nextCandidates);
  };

  const updateCandidate = (id, changes) => updateCandidates(candidates.map((candidate) => (
    candidate.id === id ? (typeof changes.nonSaleable === "boolean"
      ? changeCandidateClassification({ ...candidate, ...changes, nonSaleable: candidate.nonSaleable }, changes.nonSaleable)
      : { ...candidate, ...changes }) : candidate
  )));

  const autoResolveDuplicates = () => {
    const seen = new Map();
    const resolved = candidates.map((candidate) => {
      if (!candidate.selected) return candidate;
      // Clean previous auto-resolve suffixes to prevent compounding "(Excluded) (Excluded)..."
      const cleanLot = String(candidate.lotNumber || "")
        .replace(/\s*\((?:Excluded|Park|Facility)[^)]*\)/gi, "")
        .replace(/-[A-Z0-9]+$/i, "")
        .trim();
      const key = `${candidate.block || ""}:${cleanLot}`.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, 1);
        return { ...candidate, lotNumber: cleanLot || candidate.lotNumber };
      }
      const count = seen.get(key) + 1;
      seen.set(key, count);
      if (candidate.category === "park") {
        return { ...candidate, lotNumber: `${cleanLot || "Park"}-${count}` };
      }
      if (candidate.category === "facility") {
        return { ...candidate, lotNumber: `${cleanLot || "Facility"}-${count}` };
      }
      if (candidate.category === "excluded") {
        return { ...candidate, lotNumber: `${cleanLot || "EX"}-${count}` };
      }
      if (Number(candidate.areaSqm) >= 300) {
        return { ...candidate, block: candidate.block ? `${candidate.block} (Comm)` : "Commercial" };
      }
      return { ...candidate, lotNumber: `${cleanLot || candidate.lotNumber}-${String.fromCharCode(64 + count)}` };
    });
    updateCandidates(resolved);
  };

  const activateCandidate = (id, focusPlan = false, scrollRow = false) => {
    setActiveId(id);
    if (focusPlan) {
      setFocusRequest({ id, time: performance.now() });
      previewRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (scrollRow) {
      setFilterTab("all");
      setRowRequest({ id, time: performance.now() });
    }
  };

  const handleSubmit = async () => {
    if (!canImport || submitLock.current) return;
    submitLock.current = true;
    setSubmitError("");
    try {
      await onImport();
    } catch (importError) {
      setSubmitError(importError?.message || "Could not create the selected lots. Please try again.");
    } finally {
      submitLock.current = false;
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4" style={{ zIndex: 5000 }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lot-import-title" aria-describedby="lot-import-description"
        tabIndex={-1} onKeyDown={handleDialogKey}
        className="flex h-[94dvh] w-full min-w-0 max-w-7xl flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl outline-none sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-700 p-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3"><Layers className="h-5 w-5 shrink-0 text-cyan-400" /><h2 id="lot-import-title" className="text-lg font-bold text-white">Review detected lots</h2></div>
            <p id="lot-import-description" className="mt-2 text-sm text-slate-300">Check the boundaries and details, then create the lots you approve.</p>
            {sourceName && <p className="mt-1 truncate text-xs text-slate-400" title={sourceName}>{sourceName}</p>}
          </div>
          <button type="button" disabled={isImporting} onClick={onClose} aria-label="Close lot import review"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>

        {warnings.length > 0 && <details className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-4 py-2 text-xs text-amber-200 sm:px-6">
          <summary className="cursor-pointer py-1 font-semibold">Detection notes ({warnings.length})</summary>
          <div className="max-h-24 space-y-1 overflow-y-auto py-2">{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>
        </details>}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:overflow-hidden">
          <div ref={previewRef} className="h-[32rem] min-w-0 shrink-0 border-b border-slate-700 lg:h-auto lg:min-h-0 lg:border-b-0 lg:border-r">
            <LotPlanPreview candidates={candidates} activeId={activeId} focusRequest={focusRequest} imageUrl={imageUrl}
              pageWidth={pageWidth} pageHeight={pageHeight} disabled={isImporting} onUpdate={updateCandidate}
              onActivate={(id) => activateCandidate(id, false, true)} />
          </div>
          <div className="flex min-w-0 shrink-0 flex-col lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 p-3">
              <p className="text-sm font-semibold text-cyan-300" aria-live="polite">{selected.length} / {candidates.length} included</p>
              <div className="flex flex-wrap gap-2">
                {hasDuplicateSelected && (
                  <button type="button" disabled={isImporting} onClick={autoResolveDuplicates}
                    className="min-h-11 rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 shadow-sm transition-colors hover:bg-amber-500/30">
                    ⚡ Auto-fix duplicate names
                  </button>
                )}
                <button type="button" disabled={isImporting || !candidates.length} onClick={() => updateCandidates(candidates.map((candidate) => ({ ...candidate, selected: true })))} className={buttonClass}>Select all</button>
                <button
                  type="button"
                  disabled={isImporting || (!validCandidatesCount && !candidates.some((c) => !issues.get(c.id)?.length && !c.nonSaleable))}
                  onClick={() => updateCandidates(candidates.map((candidate) => ({
                    ...candidate,
                    selected: candidates.some((c) => c.nonSaleable)
                      ? (!issues.get(candidate.id)?.length && !candidate.nonSaleable)
                      : !issues.get(candidate.id)?.length
                  })))}
                  className={buttonClass}
                >
                  {candidates.some((c) => c.nonSaleable)
                    ? `Select valid saleable (${candidates.filter((c) => !issues.get(c.id)?.length && !c.nonSaleable).length})`
                    : `Select valid only (${validCandidatesCount})`}
                </button>
                <button type="button" disabled={isImporting || !selected.length} onClick={() => updateCandidates(candidates.map((candidate) => ({ ...candidate, selected: false })))} className={buttonClass}>Clear all</button>
              </div>
            </div>
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <p className="px-4 pt-3 text-xs leading-relaxed text-slate-400">Check the block, lot number and printed area. Correct the saleability if needed: green means saleable, violet means non-saleable. Use the checkbox to include a candidate in this import.</p>
              {candidates.length ? <LotCandidateList candidates={candidates} issues={issues} activeId={activeId}
                onActivate={activateCandidate} onUpdate={updateCandidate} disabled={isImporting} rowRefs={rowRefs}
                filterTab={filterTab} setFilterTab={setFilterTab} />
                : <p className="p-6 text-sm text-slate-300">No candidate boundaries were detected in this plan.</p>}
            </div>
            <div className="shrink-0 border-t border-slate-700 px-4 py-2">
              <button type="button" disabled={isImporting || !originalBoundaries.current.has(activeId)} className={`${buttonClass} flex items-center gap-2`}
                onClick={() => updateCandidate(activeId, { points: originalBoundaries.current.get(activeId).map((point) => [...point]) })}>
                <RotateCcw className="h-3.5 w-3.5" />Reset active boundary
              </button>
            </div>
          </div>
        </div>

        <footer className="shrink-0 space-y-3 border-t border-slate-700 bg-slate-900 p-4 sm:px-6">
          {(error || submitError) && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error || submitError}</p>}
          {invalidSelectedCandidates.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="status" className="flex items-start gap-2 font-semibold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    {invalidCount} included {invalidCount === 1 ? "lot needs" : "lots need"} corrections before creating. Fix the highlighted details or exclude these candidates.
                  </span>
                </p>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => {
                    const invalidIds = new Set(invalidSelectedCandidates.map((c) => c.id));
                    updateCandidates(candidates.map((c) => invalidIds.has(c.id) ? { ...c, selected: false } : c));
                  }}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
                >
                  Exclude all invalid ({invalidSelectedCandidates.length})
                </button>
              </div>

              <div className="mt-2.5 max-h-40 space-y-2 overflow-y-auto pr-1">
                {invalidSelectedCandidates.map((candidate) => {
                  const index = candidates.findIndex((c) => c.id === candidate.id);
                  const candidateIssues = issues.get(candidate.id) || [];
                  const label = candidate.block
                    ? `Block ${candidate.block} Lot ${candidate.lotNumber || "—"}`
                    : (candidate.lotNumber ? `Lot ${candidate.lotNumber}` : `Candidate ${index + 1} (No lot number)`);

                  return (
                    <div
                      key={candidate.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-slate-900/80 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-amber-300">Candidate {index + 1}:</span>
                          <span className="font-semibold text-white">{label}</span>
                          <span className="text-[11px] text-slate-400">
                            {candidate.areaSqm ? `${candidate.areaSqm} m²` : "No area"} • {candidate.nonSaleable ? "Non-saleable" : "Saleable"}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-rose-300">
                          {candidateIssues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-rose-400 font-bold">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => activateCandidate(candidate.id, true, true)}
                          aria-label={`Review candidate ${index + 1}: ${label}`}
                          className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/30"
                          title="Focus and scroll to this candidate"
                        >
                          View / Fix →
                        </button>
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => updateCandidate(candidate.id, { selected: false })}
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-200"
                          title="Exclude from this import"
                        >
                          Exclude
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-200">
            <input type="checkbox" checked={confirmed} disabled={isImporting} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" />
            I checked the map alignment, included boundaries, lot numbers and areas.
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={isImporting} onClick={onClose} className={buttonClass}>Back to alignment</button>
            <button type="button" disabled={!canImport} onClick={handleSubmit}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isImporting ? "Creating lots…" : `Create ${selected.length} approved ${selected.length === 1 ? "lot" : "lots"}`}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
