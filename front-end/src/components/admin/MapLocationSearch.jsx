// front-end/src/components/admin/MapLocationSearch.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, X, Loader2, ArrowRight } from "lucide-react";
import { useMap } from "react-leaflet";
import { geocodeAddress, searchLocationSuggestions } from "../../utils/geocoding";

export function MapLocationSearch({ onLocationSelected }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)
  );
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Listen to fullscreen changes to hide search bar during presentation
  useEffect(() => {
    const handlePresentationChange = (e) => {
      setIsFullscreen(!!e.detail.isFullscreen);
    };

    window.addEventListener("presentationModeChange", handlePresentationChange);
    return () => {
      window.removeEventListener("presentationModeChange", handlePresentationChange);
    };
  }, []);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live real-time suggestions as the user types (e.g. "timawa")
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const suggestions = await searchLocationSuggestions(query);
        setResults(suggestions);
        setIsOpen(suggestions.length > 0);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (results.length > 0) {
      handleSelectLocation(results[0]);
      return;
    }

    setLoading(true);
    try {
      const data = await geocodeAddress(query);
      if (data) {
        handleSelectLocation(data);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (location) => {
    const coords = [location.lat, location.lng];
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const dist = Math.hypot(
        currentCenter.lat - coords[0],
        currentCenter.lng - coords[1]
      );

      if (dist < 0.008) {
        map.flyTo(coords, 18.5, { duration: 1.3, easeLinearity: 0.2 });
      } else {
        const midZoom = Math.max(11, currentZoom - 4);
        const midLat = (currentCenter.lat + coords[0]) / 2;
        const midLng = (currentCenter.lng + coords[1]) / 2;

        map.flyTo([midLat, midLng], midZoom, { duration: 0.85, easeLinearity: 0.35 });

        map.once("moveend", () => {
          setTimeout(() => {
            map.flyTo(coords, 18.5, { duration: 1.5, easeLinearity: 0.18 });
          }, 80);
        });
      }
    }

    if (onLocationSelected) {
      onLocationSelected({
        coordinates: coords,
        name: location.displayName || location.name,
      });
    }

    setIsOpen(false);
    setQuery(location.displayName ? location.displayName.split(",")[0] : location.name || query);
  };

  if (isFullscreen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute top-3.5 left-4 z-[1000] w-72 sm:w-80 md:w-96 transition-all duration-200"
    >
      {/* Modern Seamless Floating Pill Search Bar */}
      <form
        onSubmit={handleSearch}
        className="flex items-center h-11 px-3.5 bg-white/95 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900/95 backdrop-blur-md rounded-full border border-gray-300/80 dark:border-slate-700/70 shadow-lg shadow-black/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
      >
        <div className="text-gray-500 dark:text-slate-400 mr-2 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search location in Iloilo..."
          className="w-full h-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none"
        />

        {query.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {query.trim() && (
          <button
            type="submit"
            disabled={loading}
            className="w-7 h-7 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-full flex items-center justify-center shadow transition-all shrink-0"
            title="Go to location"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Modern Floating Results Card */}
      {isOpen && results.length > 0 && (
        <div className="mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700/80 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden max-h-64 overflow-y-auto">
          <div className="py-1">
            {results.map((r, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectLocation(r)}
                className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-100/90 dark:hover:bg-slate-800/90 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-slate-800/60 last:border-0"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                </div>
                <span className="line-clamp-1 leading-snug">{r.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
