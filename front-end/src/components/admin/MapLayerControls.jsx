import React, { useState, useEffect, useRef, useCallback } from "react";
import { Layers, Maximize, Minimize } from "lucide-react";
import { TileLayer } from "react-leaflet";


export const MAP_LAYERS = {
  SATELLITE: "satellite",
  STREETS: "streets",
  HYBRID: "hybrid",
};

// Inject CSS once at module load — smooth hardware-accelerated cross-fade on layer container
(function injectTileTransitionStyle() {
  if (typeof document === "undefined") return;
  const oldStyle = document.getElementById("gdep-tile-transition-style");
  if (oldStyle) oldStyle.remove();

  const style = document.createElement("style");
  style.id = "gdep-tile-transition-style";
  style.textContent = `
    .gdep-smooth-tile-layer {
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
      will-change: opacity;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
})();

const TILE_SHARED_PROPS = {
  subdomains: ["0", "1", "2", "3"],
  maxZoom: 28,
  maxNativeZoom: 20,
  crossOrigin: false,
  // Leaflet must refresh its grid while a long flyTo crosses the map. Deferring
  // this until moveend leaves the old grid behind and exposes the dark map
  // background (the blank satellite state shown in the report).
  keepBuffer: 8,
  updateWhenZooming: true,
  updateWhenIdle: false,
  updateInterval: 100,
};

// Base regional overview layer (Zoom 1-13) mounted persistently beneath the detail layer.
// When camera flies up to cruise altitude (z12-14) during long-distance navigation,
// this layer paints the entire island/region seamlessly edge-to-edge with 0 CPU overhead.
const OVERVIEW_TILE_PROPS = {
  subdomains: ["0", "1", "2", "3"],
  minZoom: 1,
  maxZoom: 28,
  maxNativeZoom: 13,
  crossOrigin: false,
  keepBuffer: 6,
  updateWhenZooming: true,
  updateWhenIdle: false,
  updateInterval: 100,
  zIndex: 1,
};

const TILE_LAYER_CONFIG = {
  [MAP_LAYERS.SATELLITE]: {
    url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  },
  [MAP_LAYERS.STREETS]: {
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  },
  [MAP_LAYERS.HYBRID]: {
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  },
};

function prepareTile({ tile }) {
  // Decode downloaded imagery off the synchronous rendering path where the
  // browser supports it. Keep Leaflet's normal grid updates and tile retention.
  tile.decoding = "async";
}

/**
 * Smooth cross-fade tile layer controller.
 * Only mounts the current map and, during a switch, one incoming map. Keeping all
 * three providers mounted made every pan and flight update three tile grids, which
 * is noticeably expensive on mobile and slower laptops.
 */
export function ActiveMapTileLayer({ activeLayer = MAP_LAYERS.SATELLITE }) {
  const [renderedLayers, setRenderedLayers] = useState(() => ({
    [activeLayer]: { opacity: 1, zIndex: 2 },
  }));
  const displayedLayerRef = useRef(activeLayer);
  const transitionTimerRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const transitionIdRef = useRef(0);

  const clearTransitionTimers = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
  }, []);

  const completeTransition = useCallback((transition) => {
    if (!transition || pendingTransitionRef.current?.id !== transition.id) return;

    pendingTransitionRef.current = null;
    displayedLayerRef.current = transition.next;
    setRenderedLayers({ [transition.next]: { opacity: 1, zIndex: 2 } });
  }, []);

  const beginCrossFade = useCallback((transition) => {
    if (!transition || pendingTransitionRef.current?.id !== transition.id) return;
    if (transition.isFading) return;
    transition.isFading = true;

    // Keep the previous layer painted beneath the incoming one. This prevents a
    // blank map while a slow tile request is still resolving.
    setRenderedLayers({
      [transition.previous]: { opacity: 1, zIndex: 2 },
      [transition.next]: { opacity: 1, zIndex: 3 },
    });

    transitionTimerRef.current = setTimeout(() => completeTransition(transition), 380);
  }, [completeTransition]);

  const handleLayerLoad = useCallback((layerId) => {
    const pending = pendingTransitionRef.current;
    if (pending?.next === layerId) beginCrossFade(pending);
  }, [beginCrossFade]);

  // Smooth cross-fade transition when activeLayer changes
  useEffect(() => {
    clearTransitionTimers();
    const previousLayer = displayedLayerRef.current;
    if (previousLayer === activeLayer) {
      pendingTransitionRef.current = null;
      setRenderedLayers({ [activeLayer]: { opacity: 1, zIndex: 2 } });
      return;
    }

    const transition = {
      id: ++transitionIdRef.current,
      previous: previousLayer,
      next: activeLayer,
    };
    pendingTransitionRef.current = transition;

    // Place the new layer above the active one but keep it transparent until it
    // has tiles. The old map never disappears before the new map can be shown.
    setRenderedLayers({
      [previousLayer]: { opacity: 1, zIndex: 2 },
      [activeLayer]: { opacity: 0, zIndex: 3 },
    });

    return () => {
      clearTransitionTimers();
    };
  }, [activeLayer, beginCrossFade, clearTransitionTimers]);

  useEffect(() => () => clearTransitionTimers(), [clearTransitionTimers]);

  return (
    <>
      <TileLayer
        key={`gdep-overview-${activeLayer}`}
        url={TILE_LAYER_CONFIG[activeLayer]?.url || TILE_LAYER_CONFIG[MAP_LAYERS.SATELLITE].url}
        className="gdep-smooth-tile-layer"
        opacity={1}
        eventHandlers={{ tileloadstart: prepareTile }}
        {...OVERVIEW_TILE_PROPS}
      />
      {Object.entries(renderedLayers).map(([layerId, layerState]) => (
        <TileLayer
          key={`gdep-tile-${layerId}`}
          url={TILE_LAYER_CONFIG[layerId].url}
          className="gdep-smooth-tile-layer"
          opacity={layerState.opacity}
          zIndex={layerState.zIndex}
          eventHandlers={{ load: () => handleLayerLoad(layerId), tileloadstart: prepareTile }}
          {...TILE_SHARED_PROPS}
        />
      ))}
    </>
  );
}

/**
 * Floating modern dark-glassmorphic controls matching exact UI design
 */
export function MapLayerControls({
  activeLayer,
  onLayerChange,
  mapContainerRef,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dropdownRef = useRef(null);

  // Close layer dropdown on outside click (with iPad/tablet touch support)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Toggle fullscreen presentation mode safely across mobile and desktop
  const handleToggleFullscreen = useCallback(() => {
    try {
      const targetElement = mapContainerRef?.current;
      const willBeFullscreen = !isFullscreen;
      setIsFullscreen(willBeFullscreen);

      if (targetElement) {
        if (willBeFullscreen) {
          targetElement.classList.add("map-presentation-fullscreen");
        } else {
          targetElement.classList.remove("map-presentation-fullscreen");
        }
      }

      window.dispatchEvent(
        new CustomEvent("presentationModeChange", {
          detail: { isFullscreen: willBeFullscreen },
        })
      );

      // Recalculate map dimensions
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 80);
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
    }
  }, [isFullscreen, mapContainerRef]);

  // Listen to Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        handleToggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, handleToggleFullscreen]);

  const layerOptions = [
    {
      id: MAP_LAYERS.SATELLITE,
      title: "Satellite",
      desc: "High-resolution aerial",
      iconEmoji: "🛰️",
    },
    {
      id: MAP_LAYERS.STREETS,
      title: "Street Map",
      desc: "Clean roads & places",
      iconEmoji: "🛣️",
    },
    {
      id: MAP_LAYERS.HYBRID,
      title: "Hybrid",
      desc: "Satellite with labels",
      iconEmoji: "🗺️",
    },
  ];

  return (
    <>
      <div className="absolute top-3 right-4 z-[1000] flex items-center gap-2">
        {/* Layer Switcher Button & Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg border backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ${
              isOpen || activeLayer !== MAP_LAYERS.SATELLITE
                ? "bg-blue-600 border-blue-500 text-white shadow-blue-600/30"
                : "bg-white/95 dark:bg-blue-600 border-gray-300/80 dark:border-blue-500 text-blue-600 dark:text-white hover:bg-gray-100 dark:hover:bg-blue-700 shadow-black/10 dark:shadow-blue-600/30"
            }`}
            title="Map Style (Satellite / Street Map / Hybrid)"
          >
            <Layers className="w-5 h-5 text-current stroke-[2.2]" />
          </button>

          {/* Layer Options Popover - Matching Exact UI Design */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700/80 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden py-2.5 px-2 animate-in fade-in zoom-in-95 duration-150">
              {/* Header Title */}
              <div className="px-2 pb-2 text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider select-none">
                MAP STYLE
              </div>

              {/* Options List */}
              <div className="space-y-1.5">
                {layerOptions.map((opt) => {
                  const isSelected = activeLayer === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onLayerChange(opt.id);
                        setIsOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-3 transition-all duration-150 ${
                        isSelected
                          ? "border border-blue-500/90 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-white shadow-sm ring-1 ring-blue-500/40"
                          : "border border-transparent text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      {/* Icon Badge */}
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-base shrink-0 shadow-inner">
                        {opt.iconEmoji}
                      </div>

                      {/* Text Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">
                          {opt.title}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight mt-0.5 truncate">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Presentation Mode Button */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
            isFullscreen
              ? "bg-emerald-600 border-emerald-400 text-white shadow-emerald-600/30"
              : "bg-white/95 dark:bg-[#1e293b]/95 border-gray-300/80 dark:border-slate-700/80 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800 backdrop-blur-md shadow-black/10 dark:shadow-black/20"
          }`}
          title={
            isFullscreen
              ? "Exit Fullscreen Presentation (ESC)"
              : "Full-Screen Presentation Mode"
          }
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5 text-white stroke-[2.2]" />
          ) : (
            <Maximize className="w-5 h-5 text-gray-700 dark:text-white stroke-[2.2]" />
          )}
        </button>
      </div>
    </>
  );
}
