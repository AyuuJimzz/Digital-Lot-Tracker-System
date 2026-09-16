import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Layers, Loader2, Plus, X } from "lucide-react";
import LotCandidateList from "./lotImport/LotCandidateList";
import LotPlanPreview from "./lotImport/LotPlanPreview";
import { getCandidateIssues } from "./lotImport/reviewValidation";
import { changeCandidateClassification } from "./lotImport/candidateClassification";
import { prepareBlueprintPdf } from "../../utils/blueprintPdf";

export function resolveDuplicateCandidates(candidatesList) {
  if (!Array.isArray(candidatesList) || !candidatesList.length) return candidatesList;
  const seen = new Map();
  return candidatesList.map((candidate) => {
    // Clean previous auto-resolve suffixes to prevent compounding "(Excluded) (Excluded)..."
    const cleanLot = String(candidate.lotNumber || "")
      .replace(/\s*\((?:Park|Facility|Road|Excluded|Non-Saleable|\d+)\)\s*$/gi, "")
      .trim();
    if (!cleanLot) return candidate;
    const baseKey = `${candidate.block || ""}:${cleanLot}`.trim().toLowerCase();
    const count = seen.get(baseKey) || 0;
    seen.set(baseKey, count + 1);

    if (count === 0) return { ...candidate, lotNumber: cleanLot };

    let nextLot = `${cleanLot} (${count + 1})`;
    if (candidate.nonSaleable) {
      const cat = candidate.category === "park" ? "Park"
        : candidate.category === "facility" ? "Facility"
        : candidate.category === "road" ? "Road" : "Excluded";
      nextLot = count === 1 ? `${cleanLot} (${cat})` : `${cleanLot} (${cat} ${count})`;
    }
    return { ...candidate, lotNumber: nextLot };
  });
}

export function LotImportReviewModal({
  candidates = [], onCandidatesChange, onClose, onImport, isImporting = false,
  error, sourceName, existingLotNumbers = [], imageUrl, pageWidth, pageHeight, warnings = [],
  autoFixDuplicates = false, onRescan, isRescanning = false, autoSelectAll = false,
}) {
  const dialogRef = useRef(null);
  const previewRef = useRef(null);
  const viewportRef = useRef(null);
  const rowRefs = useRef({});
  const rescanInputRef = useRef(null);
  const submitLock = useRef(false);
  const originalBoundaries = useRef(new Map(candidates.map((candidate) => [candidate.id, candidate.points.map((point) => [...point])])));
  const [activeId, setActiveId] = useState(candidates[0]?.id);
  const [focusRequest, setFocusRequest] = useState(null);
  const [rowRequest, setRowRequest] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isEditingShape, setIsEditingShape] = useState(false);
  const [internalRescanning, setInternalRescanning] = useState(false);
  const [rescanStage, setRescanStage] = useState("");
  const effectiveRescanning = isRescanning || internalRescanning;
  const issues = useMemo(() => getCandidateIssues(candidates, existingLotNumbers), [candidates, existingLotNumbers]);
  const selected = candidates.filter((candidate) => candidate.selected);
  const invalidSelectedCandidates = useMemo(
    () => selected.filter((candidate) => Boolean(issues.get(candidate.id)?.length)),
    [selected, issues],
  );
  const invalidCount = invalidSelectedCandidates.length;
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
  const buttonClass = "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

  const handleViewportChange = useCallback((vp) => {
    viewportRef.current = vp;
  }, []);

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

  const updateCandidates = useCallback((nextCandidates) => {
    if (isImporting) return;
    setConfirmed(false);
    setSubmitError("");
    onCandidatesChange(nextCandidates);
  }, [isImporting, onCandidatesChange]);

  const updateCandidate = (id, changes) => updateCandidates(candidates.map((candidate) => (
    candidate.id === id ? (typeof changes.nonSaleable === "boolean"
      ? changeCandidateClassification({ ...candidate, ...changes, nonSaleable: candidate.nonSaleable }, changes.nonSaleable)
      : { ...candidate, ...changes }) : candidate
  )));

  const autoFixedMountRef = useRef(false);
  useEffect(() => {
    if (autoFixDuplicates && !autoFixedMountRef.current && hasDuplicateSelected) {
      autoFixedMountRef.current = true;
      updateCandidates(resolveDuplicateCandidates(candidates));
    }
  }, [autoFixDuplicates, hasDuplicateSelected, candidates, updateCandidates]);

  // Automatically select all lots (including excluded/non-saleable) when autoSelectAll is enabled
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectAll && !hasAutoSelectedRef.current) {
      if (candidates.length > 0) {
        hasAutoSelectedRef.current = true;
        if (candidates.some((c) => !c.selected)) {
          const next = candidates.map((c) => ({ ...c, selected: true }));
          updateCandidates(autoFixDuplicates ? resolveDuplicateCandidates(next) : next);
        }
      }
    }
  }, [autoSelectAll, autoFixDuplicates, candidates, updateCandidates]);

  const autoResolveDuplicates = () => {
    updateCandidates(resolveDuplicateCandidates(candidates));
  };

  const activateCandidate = (id, focusPlan = true, scrollRow = false) => {
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

  const handleAddManualCandidate = useCallback(() => {
    if (isImporting) return;

    const activeCandidate = candidates.find((c) => c.id === activeId);
    const vp = viewportRef.current;

    let points;
    if (vp && vp.centerX !== undefined && vp.centerY !== undefined) {
      // Create a neat box centered directly where the user is looking
      const boxW = Math.max(0.02, Math.min(0.06, (vp.viewWidthNorm || 0.2) * 0.35));
      const boxH = Math.max(0.02, Math.min(0.06, (vp.viewHeightNorm || 0.2) * 0.35));
      const cx = Math.max(boxW / 2 + 0.01, Math.min(0.99 - boxW / 2, vp.centerX));
      const cy = Math.max(boxH / 2 + 0.01, Math.min(0.99 - boxH / 2, vp.centerY));

      const x1 = Number((cx - boxW / 2).toFixed(4));
      const x2 = Number((cx + boxW / 2).toFixed(4));
      const y1 = Number((cy - boxH / 2).toFixed(4));
      const y2 = Number((cy + boxH / 2).toFixed(4));

      points = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ];
    } else if (activeCandidate?.points?.length) {
      const xs = activeCandidate.points.map(([x]) => x);
      const ys = activeCandidate.points.map(([, y]) => y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = Math.max(0.015, Math.min(0.06, maxX - minX));
      const height = Math.max(0.015, Math.min(0.06, maxY - minY));

      let startX = maxX + 0.005;
      let startY = minY;
      if (startX + width > 0.98) {
        startX = Math.max(0.02, minX - width - 0.005);
      }
      if (startX < 0.02) {
        startX = minX;
        startY = Math.min(0.95 - height, maxY + 0.005);
      }

      points = [
        [Number(startX.toFixed(4)), Number(startY.toFixed(4))],
        [Number((startX + width).toFixed(4)), Number(startY.toFixed(4))],
        [Number((startX + width).toFixed(4)), Number((startY + height).toFixed(4))],
        [Number(startX.toFixed(4)), Number((startY + height).toFixed(4))],
      ];
    } else {
      // Default center box
      points = [
        [0.46, 0.46],
        [0.54, 0.46],
        [0.54, 0.54],
        [0.46, 0.54],
      ];
    }

    // Smart block and lot number guessing
    const defaultBlock = activeCandidate?.block || candidates[candidates.length - 1]?.block || "1";

    const sameBlockLots = candidates
      .filter((c) => String(c.block || "").trim().toLowerCase() === String(defaultBlock).trim().toLowerCase())
      .map((c) => parseInt(String(c.lotNumber).replace(/\D/g, ""), 10))
      .filter((num) => !isNaN(num));

    let nextLotNum = "1";
    if (sameBlockLots.length > 0) {
      nextLotNum = String(Math.max(...sameBlockLots) + 1);
    } else if (activeCandidate?.lotNumber && !isNaN(parseInt(activeCandidate.lotNumber, 10))) {
      nextLotNum = String(parseInt(activeCandidate.lotNumber, 10) + 1);
    } else {
      nextLotNum = String(candidates.length + 1);
    }

    const defaultArea = activeCandidate?.areaSqm || 120;
    const newId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newCandidate = {
      id: newId,
      points,
      block: defaultBlock,
      lotNumber: nextLotNum,
      areaSqm: defaultArea,
      selected: true,
      nonSaleable: false,
      category: "residential",
      warnings: [],
      isManual: true,
    };

    originalBoundaries.current.set(newId, points.map((p) => [...p]));

    // Put at top of list so it is instantly noticeable in the sidebar
    const nextCandidates = [newCandidate, ...candidates];

    updateCandidates(nextCandidates);
    setIsEditingShape(true);
    activateCandidate(newId, false, true);
  }, [activeId, candidates, isImporting, updateCandidates]);

  const handleTriggerDeepRescan = useCallback(() => {
    if (onRescan) {
      onRescan();
      return;
    }
    rescanInputRef.current?.click();
  }, [onRescan]);

  const handleDeepRescanFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setInternalRescanning(true);
    setRescanStage("Opening PDF for Deep Scan...");
    try {
      const result = await prepareBlueprintPdf(file, 1, (stage) => setRescanStage(stage), { deepScan: true, maxGap: 4.5 });
      if (result?.lotImport?.candidates?.length) {
        updateCandidates(result.lotImport.candidates);
      }
    } catch (err) {
      setSubmitError(err.message || "Deep re-scan failed.");
    } finally {
      setInternalRescanning(false);
      setRescanStage("");
    }
  };

  const handleDeleteCandidate = useCallback((id) => {
    if (isImporting) return;
    const nextCandidates = candidates.filter((c) => c.id !== id);
    updateCandidates(nextCandidates);
    if (activeId === id) {
      const remaining = nextCandidates[0]?.id || null;
      if (remaining) {
        activateCandidate(remaining, true, true);
      } else {
        setActiveId(null);
        setIsEditingShape(false);
      }
    }
  }, [activeId, candidates, isImporting, updateCandidates]);

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
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-1.5 sm:p-2.5" style={{ zIndex: 5000 }}>
      <input ref={rescanInputRef} type="file" accept="application/pdf,image/*" className="hidden" aria-hidden="true" onChange={handleDeepRescanFile} />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lot-import-title" aria-describedby="lot-import-description"
        tabIndex={-1} onKeyDown={handleDialogKey}
        className="flex h-[97dvh] w-[99vw] max-w-[1920px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1e293b] text-slate-100 shadow-2xl outline-none">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
          <div className="min-w-0 flex items-center gap-3">
            <Layers className="h-4 w-4 shrink-0 text-slate-400" />
            <h2 id="lot-import-title" className="text-sm font-semibold text-white">Review detected lots</h2>
            {sourceName && <span className="hidden truncate text-xs text-slate-500 sm:inline" title={sourceName}>— {sourceName}</span>}
            {rescanStage && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                {rescanStage}
              </span>
            )}
          </div>
          <p id="lot-import-description" className="sr-only">Check the boundaries and details, then create the lots you approve.</p>
          <button type="button" disabled={isImporting || effectiveRescanning} onClick={onClose} aria-label="Close lot import review"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-40 transition-colors"><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${isMapExpanded ? "lg:flex" : "lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(350px,1fr)]"} lg:overflow-hidden`}>
          <div ref={previewRef} className={`${isMapExpanded ? "flex-1 min-h-0" : "h-[32rem] min-w-0 shrink-0 border-b border-white/[0.06] lg:h-auto lg:min-h-0 lg:border-b-0 lg:border-r"}`}>
            <LotPlanPreview candidates={candidates} activeId={activeId} focusRequest={focusRequest} imageUrl={imageUrl}
              pageWidth={pageWidth} pageHeight={pageHeight} disabled={isImporting || effectiveRescanning} onUpdate={updateCandidate}
              onActivate={(id) => activateCandidate(id, false, true)}
              onViewportChange={handleViewportChange}
              isExpanded={isMapExpanded} onToggleExpand={() => setIsMapExpanded((prev) => !prev)}
              isEditingShape={isEditingShape} onToggleEditShape={setIsEditingShape}
              onAddManualCandidate={handleAddManualCandidate}
              onRescan={handleTriggerDeepRescan} isRescanning={effectiveRescanning}
              onResetBoundary={() => {
                if (originalBoundaries.current.has(activeId)) {
                  updateCandidate(activeId, {
                    points: originalBoundaries.current.get(activeId).map((point) => [...point]),
                  });
                }
              }}
              canResetBoundary={!isImporting && originalBoundaries.current.has(activeId)} />
          </div>
          <div className={`${isMapExpanded ? "hidden" : "flex min-w-0 shrink-0 flex-col lg:min-h-0"}`}>
            <div className="sr-only">
              <span aria-live="polite">
                {selected.length} / {candidates.length} included
              </span>
              <button
                type="button"
                disabled={isImporting || !candidates.length}
                onClick={() => updateCandidates(candidates.map((candidate) => ({ ...candidate, selected: true })))}
              >
                Select all
              </button>
              <button
                type="button"
                disabled={isImporting || !selected.length}
                onClick={() => updateCandidates(candidates.map((candidate) => ({ ...candidate, selected: false })))}
              >
                Clear all
              </button>
            </div>

            {hasDuplicateSelected && (
              <div className="mx-3 mt-2 flex items-center justify-between gap-2 border-b border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Duplicate lot identifiers detected in selection
                </span>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={autoResolveDuplicates}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-200 transition-colors disabled:opacity-40"
                >
                  Auto-fix →
                </button>
              </div>
            )}
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {candidates.length ? (
                <LotCandidateList
                  candidates={candidates}
                  issues={issues}
                  activeId={activeId}
                  onActivate={activateCandidate}
                  onUpdate={updateCandidate}
                  onDelete={handleDeleteCandidate}
                  disabled={isImporting}
                  rowRefs={rowRefs}
                  filterTab={filterTab}
                  setFilterTab={setFilterTab}
                  isEditingShape={isEditingShape}
                  onToggleEditShape={setIsEditingShape}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm font-medium text-slate-300">No candidate boundaries were detected in this plan.</p>
                  <p className="mt-1 text-xs text-slate-400">You can manually add missing lots directly to this blueprint.</p>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleAddManualCandidate}
                    className="mt-4 flex items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/50 transition hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add First Lot
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/[0.06] bg-[#1e293b] px-5 py-3">
          {(error || submitError) && <p role="alert" className="mb-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{error || submitError}</p>}
          {invalidSelectedCandidates.length > 0 && (
            <div className="mb-3 rounded-xl bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p role="status" className="flex items-center gap-2 text-amber-300 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {invalidCount} included {invalidCount === 1 ? "lot needs" : "lots need"} corrections
                </p>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => {
                    const invalidIds = new Set(invalidSelectedCandidates.map((c) => c.id));
                    updateCandidates(candidates.map((c) => invalidIds.has(c.id) ? { ...c, selected: false } : c));
                  }}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-200 transition-colors disabled:opacity-50"
                >
                  Exclude all invalid ({invalidSelectedCandidates.length})
                </button>
              </div>
              <div className="max-h-24 space-y-1 overflow-y-auto">
                {invalidSelectedCandidates.map((candidate) => {
                  const index = candidates.findIndex((c) => c.id === candidate.id);
                  const candidateIssues = issues.get(candidate.id) || [];
                  const label = candidate.block
                    ? `Block ${candidate.block} Lot ${candidate.lotNumber || "—"}`
                    : (candidate.lotNumber ? `Lot ${candidate.lotNumber}` : `Candidate ${index + 1}`);
                  return (
                    <div key={candidate.id} className="flex flex-wrap items-start justify-between gap-2 py-1.5 border-t border-white/[0.04]">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-amber-300">Candidate {index + 1}:</span>
                          <span className="text-slate-300 font-medium">{label}</span>
                        </div>
                        <ul className="mt-0.5 space-y-0.5 text-[11px] text-rose-400">
                          {candidateIssues.map((issue, i) => <li key={i}>· {issue}</li>)}
                        </ul>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" disabled={isImporting}
                          onClick={() => activateCandidate(candidate.id, true, true)}
                          aria-label={`Review candidate ${index + 1}: ${label}`}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40"
                        >View →</button>
                        <button type="button" disabled={isImporting}
                          onClick={() => updateCandidate(candidate.id, { selected: false })}
                          className="text-[11px] text-slate-500 hover:text-rose-300 transition-colors disabled:opacity-40"
                        >Exclude</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={confirmed} disabled={isImporting} onChange={(event) => setConfirmed(event.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded accent-cyan-400" />
              <span>I checked the map alignment, included boundaries, lot numbers and areas.</span>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" disabled={isImporting} onClick={onClose} className={buttonClass}>Back to alignment</button>
              <button type="button" disabled={!canImport} onClick={handleSubmit}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-semibold text-slate-950 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {isImporting ? "Creating lots…" : `Create ${selected.length} approved ${selected.length === 1 ? "lot" : "lots"}`}
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
