import React, { useState, useEffect, useRef, useCallback } from "react";
import { Layers, Maximize, Minimize } from "lucide-react";
import { TileLayer } from "react-leaflet";

export const MAP_LAYERS = {
  SATELLITE: "satellite",
  STREETS: "streets",
  HYBRID: "hybrid",
};

/**
 * Component that renders the appropriate map TileLayer based on active layer.
 * Uses {s} subdomain rotation (mt0-mt3) + crossOrigin=false to fix Chrome's
 * strict referrer policy that blocks Google tiles from localhost/production.
 */
export function ActiveMapTileLayer({ activeLayer = MAP_LAYERS.SATELLITE }) {
  if (activeLayer === MAP_LAYERS.STREETS) {
    return (
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
        maxZoom={21}
        maxNativeZoom={20}
        crossOrigin={false}
        keepBuffer={8}
        updateWhenZooming={false}
        updateWhenIdle={false}
        updateInterval={100}
        errorTileUrl="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    );
  }

  if (activeLayer === MAP_LAYERS.HYBRID) {
    return (
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
        maxZoom={21}
        maxNativeZoom={20}
        crossOrigin={false}
        keepBuffer={8}
        updateWhenZooming={false}
        updateWhenIdle={false}
        updateInterval={100}
        errorTileUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
    );
  }

  // Default: Google Satellite — best coverage in Philippines
  // Uses subdomain rotation to bypass per-server rate limits and Chrome referrer blocks
  return (
    <TileLayer
      url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
      subdomains={["mt0", "mt1", "mt2", "mt3"]}
      maxZoom={21}
      maxNativeZoom={20}
      crossOrigin={false}
      keepBuffer={8}
      updateWhenZooming={false}
      updateWhenIdle={false}
      updateInterval={100}
      errorTileUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    />
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

  // Close layer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
            className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
              isOpen || activeLayer !== MAP_LAYERS.SATELLITE
                ? "bg-blue-600 border-blue-400 text-white shadow-blue-600/30"
                : "bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
            }`}
            title="Map Style (Satellite / Street Map / Hybrid)"
          >
            <Layers className="w-5 h-5 text-white stroke-[2.2]" />
          </button>

          {/* Layer Options Popover - Matching Exact UI Design */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-[#0f172a]/95 backdrop-blur-xl rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden py-2.5 px-2 animate-in fade-in zoom-in-95 duration-150">
              {/* Header Title */}
              <div className="px-2 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
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
                          ? "border border-blue-500/90 bg-blue-950/40 text-white shadow-sm ring-1 ring-blue-500/40"
                          : "border border-transparent text-slate-200 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      {/* Icon Badge */}
                      <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-center text-base shrink-0 shadow-inner">
                        {opt.iconEmoji}
                      </div>

                      {/* Text Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-white leading-tight">
                          {opt.title}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
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
              : "bg-[#1e293b]/95 border-slate-700/80 text-white hover:bg-slate-800 backdrop-blur-md"
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
            <Maximize className="w-5 h-5 text-white stroke-[2.2]" />
          )}
        </button>
      </div>
    </>
  );
}
