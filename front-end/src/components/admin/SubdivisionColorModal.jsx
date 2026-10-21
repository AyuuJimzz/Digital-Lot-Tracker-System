import React, { useEffect, useMemo, useRef, useState } from "react";
import { Palette, RotateCcw, X } from "lucide-react";
import {
  normalizeHexColor,
  saveSubdivisionColor,
  resetSubdivisionColors,
  getThemeForSubdivision,
} from "../../utils/subdivisionColors";

const getSubdivisionId = (subdiv, index) =>
  String(subdiv?.id ?? subdiv?.property_id ?? subdiv?.key ?? subdiv?.name ?? `subdivision-${index}`);

const SubdivisionColorModal = ({
  isOpen,
  onClose,
  subdivisions = [],
  customColors = {},
}) => {
  const [localColors, setLocalColors] = useState(() => customColors || {});
  const [hexDrafts, setHexDrafts] = useState({});
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const saveTimeoutRef = useRef(null);
  const pendingSaveRef = useRef(null);

  const flushPendingSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { identifier, color } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveSubdivisionColor(identifier, color);
    }
  };

  const scheduleSave = (identifier, color) => {
    pendingSaveRef.current = { identifier, color };
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      flushPendingSave();
    }, 120);
  };

  const handleClose = () => {
    flushPendingSave();
    onCloseRef.current?.();
  };
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  useEffect(() => {
    setLocalColors(customColors || {});
  }, [customColors]);

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, []);

  const sortedSubdivisions = useMemo(
    () => [...subdivisions].sort((a, b) =>
      String(a?.name || a?.property_name || "").localeCompare(
        String(b?.name || b?.property_name || ""),
        undefined,
        { sensitivity: "base" }
      )
    ),
    [subdivisions]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialogRef.current?.querySelector("button")?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setHexDrafts({});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleColorChange = (subdiv, hexColor, index) => {
    const identifier = getSubdivisionId(subdiv, index);
    const normalizedColor = normalizeHexColor(hexColor);
    if (!normalizedColor) return;

    // 1. Instant local update for silky-smooth 60fps dragging and responsive swatch preview
    setLocalColors((current) => ({ ...current, [identifier]: normalizedColor }));
    setHexDrafts((current) => ({ ...current, [identifier]: normalizedColor.toUpperCase() }));

    // 2. Debounce heavy disk writes (localStorage) and global Recharts re-render
    scheduleSave(identifier, normalizedColor);
  };

  const handleHexInput = (subdiv, value, index) => {
    const identifier = getSubdivisionId(subdiv, index);
    const draft = value.slice(0, 7).toUpperCase();
    setHexDrafts((current) => ({ ...current, [identifier]: draft }));

    const normalizedColor = normalizeHexColor(draft);
    if (normalizedColor) {
      setLocalColors((current) => ({ ...current, [identifier]: normalizedColor }));
      scheduleSave(identifier, normalizedColor);
    }
  };

  const commitHexInput = (subdiv, currentHex, index) => {
    const identifier = getSubdivisionId(subdiv, index);
    const normalizedColor = normalizeHexColor(hexDrafts[identifier]);
    const finalColor = normalizedColor || currentHex;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;

    if (normalizedColor) {
      saveSubdivisionColor(identifier, normalizedColor);
      setLocalColors((current) => ({ ...current, [identifier]: normalizedColor }));
    }
    setHexDrafts((current) => ({ ...current, [identifier]: finalColor.toUpperCase() }));
  };

  const handleReset = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
    resetSubdivisionColors();
    setLocalColors({});
    setHexDrafts({});
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subdivision-color-modal-title"
        aria-describedby="subdivision-color-modal-description"
        className="flex max-h-[min(84vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-[0_24px_64px_-30px_rgba(0,0,0,0.9)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400">
              <Palette size={15} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="subdivision-color-modal-title" className="text-sm font-semibold tracking-tight text-slate-100">
                Subdivision color settings
              </h2>
              <p id="subdivision-color-modal-description" className="mt-1 text-xs leading-4 text-slate-400">
                Choose the colors used in dashboard charts.
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:block">
            {subdivisions.length} subdivisions
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close subdivision color settings"
            className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6 sm:py-4">
          {sortedSubdivisions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-300">No subdivisions available</p>
              <p className="mt-1 text-xs text-slate-500">Add a subdivision to configure its chart color.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_132px] items-center border-b border-slate-700/80 px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                <span>Subdivision</span>
                <span className="text-right">Color · HEX</span>
              </div>
              <ul aria-label="Subdivision color settings">
              {sortedSubdivisions.map((subdiv, index) => {
                const originalIndex = subdivisions.indexOf(subdiv);
                const theme = getThemeForSubdivision(subdiv, originalIndex < 0 ? index : originalIndex, localColors);
                const identifier = getSubdivisionId(subdiv, originalIndex < 0 ? index : originalIndex);
                const displayName = subdiv?.name || subdiv?.property_name || `Subdivision ${index + 1}`;
                const currentHex = normalizeHexColor(theme.hex) || "#06B6D4";
                const displayedHex = hexDrafts[identifier] ?? currentHex.toUpperCase();
                const isCustomized = Boolean(
                  normalizeHexColor(
                    localColors?.[identifier] ||
                    localColors?.[subdiv?.key] ||
                    localColors?.[displayName] ||
                    customColors?.[identifier] ||
                    customColors?.[subdiv?.key] ||
                    customColors?.[displayName]
                  )
                );
                return (
                  <li
                    key={identifier}
                    className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 border-b border-slate-800 px-1 py-3 transition-colors hover:bg-slate-800/35"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-600">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200 sm:text-sm">{displayName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {isCustomized ? "Custom" : "Default"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <label
                        aria-label={`Choose color for ${displayName}`}
                        title="Click to open color picker"
                        className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-600 bg-slate-800 transition-colors hover:border-slate-400 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-400"
                      >
                        <span className="absolute inset-1 rounded-sm shadow-inner" style={{ backgroundColor: currentHex }} aria-hidden="true" />
                        <input
                          type="color"
                          value={currentHex}
                          onChange={(event) =>
                            handleColorChange(subdiv, event.target.value, originalIndex < 0 ? index : originalIndex)
                          }
                          onBlur={flushPendingSave}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label={`Choose color for ${displayName}`}
                        />
                      </label>
                      <input
                        type="text"
                        value={displayedHex}
                        onChange={(event) => handleHexInput(subdiv, event.target.value, originalIndex < 0 ? index : originalIndex)}
                        onBlur={() => commitHexInput(subdiv, currentHex, originalIndex < 0 ? index : originalIndex)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        aria-label={`Hex color for ${displayName}`}
                        autoComplete="off"
                        spellCheck="false"
                        maxLength={7}
                        className="w-[84px] rounded-md border border-slate-700 bg-slate-950/50 px-2 py-2 text-center font-mono text-[10px] tracking-wide text-slate-300 outline-none transition-colors placeholder:text-slate-600 focus:border-slate-500 focus:text-white"
                      />
                    </div>
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </div>

        <footer className="relative flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3 sm:px-6">

          <button
            type="button"
            onClick={handleReset}
            disabled={Object.keys(localColors).length === 0 && Object.keys(customColors).length === 0}
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-400"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset colors
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
};

export default SubdivisionColorModal;
