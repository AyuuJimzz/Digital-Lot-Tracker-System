// front-end/src/components/admin/MapLocationSearch.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, X, Loader2, Navigation } from "lucide-react";
import { useMap } from "react-leaflet";
import { geocodeAddress } from "../../utils/geocoding";

export function MapLocationSearch({ onLocationSelected }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      const data = await geocodeAddress(query);
      if (data && data.allResults && data.allResults.length > 0) {
        setResults(data.allResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (location) => {
    const coords = [location.lat, location.lng];
    if (map) {
      map.flyTo(coords, 17, {
        duration: 1.5,
      });
    }

    if (onLocationSelected) {
      onLocationSelected({
        coordinates: coords,
        name: location.displayName,
      });
    }

    setIsOpen(false);
    setQuery(location.displayName.split(",")[0]); // Set clean short name in input
  };

  const handleQuickJump = (name, coords) => {
    if (map) {
      map.flyTo(coords, 18, { duration: 1.5 });
    }
    setQuery(name);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-4 left-16 z-[1000] w-72 sm:w-96 shadow-lg rounded-xl transition-all"
    >
      <form
        onSubmit={handleSearch}
        className="relative flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-md overflow-hidden"
      >
        <div className="pl-3.5 pr-1 text-gray-400 dark:text-slate-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length > 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (query.trim().length > 1 || results.length > 0) setIsOpen(true);
          }}
          placeholder="Search location, barangay, town..."
          className="w-full py-2.5 px-2 text-xs sm:text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            className="p-1 mr-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Navigation className="h-3 w-3" />
          <span className="hidden sm:inline">Go</span>
        </button>
      </form>

      {/* Dropdown Suggestions & Results */}
      {isOpen && (
        <div className="mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {/* Quick Shortcuts */}
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 font-medium">
            <span>Quick Jump (Iloilo):</span>
          </div>
          <div className="p-1.5 flex flex-wrap gap-1 border-b border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleQuickJump("Abilay Norte, Oton", [10.7372, 122.4998])}
              className="px-2 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-md transition-colors font-medium"
            >
              📍 Oton
            </button>
            <button
              type="button"
              onClick={() => handleQuickJump("Nanga, Guimbal", [10.6713, 122.3352])}
              className="px-2 py-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 rounded-md transition-colors font-medium"
            >
              📍 Guimbal
            </button>
            <button
              type="button"
              onClick={() => handleQuickJump("Pavia, Iloilo", [10.7766, 122.5447])}
              className="px-2 py-1 text-[11px] bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60 rounded-md transition-colors font-medium"
            >
              📍 Pavia
            </button>
            <button
              type="button"
              onClick={() => handleQuickJump("Mandurriao, Iloilo City", [10.7202, 122.5422])}
              className="px-2 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 rounded-md transition-colors font-medium"
            >
              📍 Mandurriao
            </button>
          </div>

          {/* Search Result items */}
          {results.length > 0 ? (
            <div className="py-1">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                Matching Locations
              </div>
              {results.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectLocation(r)}
                  className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors border-t border-gray-50 dark:border-slate-800/50 first:border-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{r.displayName}</span>
                </button>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="p-3 text-center text-xs text-gray-500 dark:text-slate-400">
              No specific GPS matches found. Try typing another place or municipality.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
