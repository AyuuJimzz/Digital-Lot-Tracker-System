import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";

import {
  MapContainer,
  Polygon,
  Popup,
  useMap,
  Marker,
  Tooltip,
} from "react-leaflet";

import axios from "axios";

import L from "leaflet";

import LotOffcanvas from "../../components/admin/LotOffcanvas";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import {
  MapLayerControls,
  ActiveMapTileLayer,
  MAP_LAYERS,
} from "../../components/admin/MapLayerControls";
import { preloadAllProperties } from "../../utils/tilePreloader";
import {
  geocodeAddress,
  MUNICIPALITY_COORDINATES,
  DEFAULT_COORDINATES_MAP,
} from "../../utils/geocoding";

import "leaflet/dist/leaflet.css";

// ── Lightweight Static Overview Location Beacon (no animation = no GPU stutter) ──
const createOverviewPropertyIcon = (name, lotCount) => {
  return L.divIcon({
    className: "property-overview-beacon-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;user-select:none;transform:translateY(-10px);">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#10b981,#047857);border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,0.4),0 4px 14px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;">
          <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
        <div style="margin-top:4px;background:rgba(15,23,42,0.95);border:1.5px solid rgba(16,185,129,0.85);padding:4px 11px;border-radius:9999px;white-space:nowrap;display:flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(0,0,0,0.65);">
          <span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block;flex-shrink:0;"></span>
          <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.3px;">${name}</span>
          ${lotCount > 0 ? `<span style="color:#6ee7b7;font-size:11px;font-weight:700;">(${lotCount})</span>` : ""}
        </div>
      </div>
    `,
    iconSize: [240, 70],
    iconAnchor: [120, 35],
  });
};

function MapController({
  selectedProperty,
  setSelectedProperty,
  setMap,
  setCurrentZoom,
  triggerArrivalPulse,
  properties,
}) {
  const map = useMap();
  const prevPropertyIdRef = useRef(selectedProperty);

  useEffect(() => {
    if (setMap) setMap(map);
    if (setCurrentZoom) setCurrentZoom(map.getZoom());

    // Real-time geo-scale & street-level class tracking on DOM container
    const container = map.getContainer();
    const updateZoomClasses = (z) => {
      const scale = Math.max(0.45, Math.pow(1.4, z - 19));
      container.style.setProperty("--road-label-scale", scale);

      // Show road text labels at comfortable subdivision view (zoom >= 18.2)
      if (z >= 18.2) {
        container.classList.add("map-zoom-street-level");
      } else {
        container.classList.remove("map-zoom-street-level");
      }
    };
    updateZoomClasses(map.getZoom());

    const handleZoomAnim = (e) => {
      updateZoomClasses(e.zoom);
    };

    const handleZoom = () => {
      updateZoomClasses(map.getZoom());
    };

    // Only update React state on zoomend
    let debounceTimer;
    const handleZoomEnd = () => {
      clearTimeout(debounceTimer);
      const z = map.getZoom();
      updateZoomClasses(z);
      debounceTimer = setTimeout(() => {
        if (setCurrentZoom) setCurrentZoom(z);
      }, 80);
    };
    // Auto-close any lingering hover tooltips when map begins moving/dragging/zooming
    const handleDismissTooltips = () => {
      try {
        map.closeTooltip();
      } catch (e) {}
    };

    map.on("zoomanim", handleZoomAnim);
    map.on("zoom", handleZoom);
    map.on("zoomend", handleZoomEnd);
    map.on("movestart", handleDismissTooltips);
    map.on("dragstart", handleDismissTooltips);
    map.on("zoomstart", handleDismissTooltips);
    return () => {
      map.off("zoomanim", handleZoomAnim);
      map.off("zoom", handleZoom);
      map.off("zoomend", handleZoomEnd);
      map.off("movestart", handleDismissTooltips);
      map.off("dragstart", handleDismissTooltips);
      map.off("zoomstart", handleDismissTooltips);
      clearTimeout(debounceTimer);
    };
  }, [map, setMap, setCurrentZoom]);

  // Ensure map recalculates its exact full-screen dimensions and supports deep zooming
  useEffect(() => {
    if (!map) return;
    map.setMaxZoom(28);
    map.setMinZoom(1);
    map.invalidateSize();

    const handleZoomIn = () => map.zoomIn(0.5);
    const handleZoomOut = () => map.zoomOut(0.5);

    window.addEventListener("mapZoomIn", handleZoomIn);
    window.addEventListener("mapZoomOut", handleZoomOut);

    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mapZoomIn", handleZoomIn);
      window.removeEventListener("mapZoomOut", handleZoomOut);
    };
  }, [map]);

  useEffect(() => {
    // Smooth cinematic navigation with dynamic distance-based duration and lot zoom-in
    const smoothNavigate = (coordinates) => {
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return;
      map.invalidateSize({ animate: false });
      map.stop();

      // Calculate real distance to target for smooth, unhurried flight & zoom-in
      let flightDuration = 2.0;
      try {
        const curCenter = map.getCenter();
        const distKm = curCenter.distanceTo(L.latLng(coordinates[0], coordinates[1])) / 1000;
        if (distKm > 15) {
          flightDuration = 3.0; // Far locations (e.g. Barotac, Guimbal from Oton)
        } else if (distKm > 5) {
          flightDuration = 2.5; // Medium distance
        } else if (distKm > 0.8) {
          flightDuration = 2.0; // Close distance
        } else {
          flightDuration = 1.6; // Same area
        }
      } catch (e) {}

      map.flyTo(coordinates, 19, {
        duration: flightDuration,
        easeLinearity: 0.18,
      });
    };

    // Listen for property navigation events
    const handleNavigateToProperty = (event) => {
      const { coordinates } = event.detail || {};
      smoothNavigate(coordinates);
      if (triggerArrivalPulse) triggerArrivalPulse(coordinates);
    };

    // Listen for property selection events (from header dropdown or overview beacon)
    const handleSelectProperty = (event) => {
      const { propertyId, coordinates: detailCoords, autoSwiped } = event.detail || {};
      if (setSelectedProperty) setSelectedProperty(propertyId);
      prevPropertyIdRef.current = propertyId;

      // If triggered by automatic map pan / swipe, do NOT flyTo (user is already looking at it)
      if (autoSwiped) return;

      let targetCoords = null;
      if (properties) {
        const found = properties.find((p) => Number(p.id) === Number(propertyId));
        if (found?.coordinates) {
          targetCoords = found.coordinates;
        }
      }
      if (!targetCoords) {
        targetCoords = detailCoords;
      }

      if (targetCoords) {
        smoothNavigate(targetCoords);
        if (triggerArrivalPulse) triggerArrivalPulse(targetCoords);
      }
    };

    window.addEventListener("navigateToProperty", handleNavigateToProperty);
    window.addEventListener("selectProperty", handleSelectProperty);

    return () => {
      window.removeEventListener("navigateToProperty", handleNavigateToProperty);
      window.removeEventListener("selectProperty", handleSelectProperty);
    };
  }, [map, setSelectedProperty, triggerArrivalPulse, properties]);

  // Auto-detect closest property when user pans / swipes the map
  useEffect(() => {
    if (!map || !properties || properties.length === 0) return;

    let debounceMoveTimer;
    const handleMoveEnd = () => {
      clearTimeout(debounceMoveTimer);
      debounceMoveTimer = setTimeout(() => {
        const curCenter = map.getCenter();
        let closestProp = null;
        let minDistanceMeters = Infinity;

        properties.forEach((p) => {
          const coords = p.coordinates;
          if (!coords || !Array.isArray(coords) || coords.length < 2) return;
          try {
            const dist = curCenter.distanceTo(L.latLng(coords[0], coords[1]));
            if (dist < minDistanceMeters) {
              minDistanceMeters = dist;
              closestProp = p;
            }
          } catch (e) {}
        });

        // If user is within 3.5km of this property and it is different from current selection
        if (closestProp && minDistanceMeters < 3500) {
          const closestId = Number(closestProp.id || closestProp.property_id);
          if (closestId && closestId !== Number(prevPropertyIdRef.current)) {
            prevPropertyIdRef.current = closestId;
            if (setSelectedProperty) setSelectedProperty(closestId);
            try {
              localStorage.setItem("selectedProperty", closestId.toString());
            } catch (e) {}
            // Dispatch event to update Header dropdown name immediately
            window.dispatchEvent(
              new CustomEvent("selectProperty", {
                detail: { propertyId: closestId, autoSwiped: true },
              })
            );
          }
        }
      }, 120);
    };

    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("moveend", handleMoveEnd);
      clearTimeout(debounceMoveTimer);
    };
  }, [map, properties, setSelectedProperty]);

  // Set view to selected property directly on initial mount (no delayed flyTo jump)
  const initialFlyDoneRef = useRef(false);
  useEffect(() => {
    if (!map || initialFlyDoneRef.current) return;
    if (!properties || properties.length === 0) {
      initialFlyDoneRef.current = true;
      map.setView([10.90, 122.60], 9, { animate: false });
      return;
    }
    const targetProp = properties.find((p) => Number(p.id) === Number(selectedProperty));
    if (targetProp && targetProp.coordinates) {
      initialFlyDoneRef.current = true;
      map.setView(targetProp.coordinates, 19, { animate: false });
      map.invalidateSize({ animate: false });
    }
  }, [map, properties, selectedProperty]);

  return null;
}

const EmployeeMapView = () => {
  const [mapData, setMapData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("mapDataCache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [map, setMap] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(19);
  const mapWrapperRef = useRef(null);
  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem("preferredMapLayer") || MAP_LAYERS.SATELLITE;
  });

  const [activePopupLot, setActivePopupLot] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    const savedProperty = localStorage.getItem("selectedProperty");
    return savedProperty ? parseInt(savedProperty) : 1;
  });

  // Clear active popup on property change
  useEffect(() => {
    setActivePopupLot(null);
  }, [selectedProperty]);

  const triggerArrivalPulse = useCallback((coords) => {
    // Pulse handled smoothly
  }, []);

  // Property locations (same as AdminHeader) - derived from mapData or fallback
  // Only show ACTIVE properties on the map
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties.filter((p) => p.status !== "inactive").map((p) => {
        let coords = DEFAULT_COORDINATES_MAP[p.property_id];
        const propLots = (mapData.lots || []).filter(
          (l) => l.property_id === p.property_id && l.coordinates && l.coordinates.length > 0
        );

        if (propLots.length > 0) {
          let sumLat = 0;
          let sumLng = 0;
          let totalPts = 0;
          propLots.forEach((l) => {
            l.coordinates.forEach(([lat, lng]) => {
              sumLat += lat;
              sumLng += lng;
              totalPts++;
            });
          });
          if (totalPts > 0) {
            coords = [sumLat / totalPts, sumLng / totalPts];
            try {
              localStorage.setItem(
                "propertyCustomCoords_" + p.property_id,
                JSON.stringify(coords)
              );
            } catch (e) {}
          }
        } else {
          try {
            const cachedCoords = localStorage.getItem("propertyCustomCoords_" + p.property_id);
            if (cachedCoords) {
              coords = JSON.parse(cachedCoords);
            }
          } catch (e) {}

          // Check municipality town database
          if (!coords) {
            const locationText = `${p.location || ""} ${p.property_name || ""}`.toLowerCase();
            for (const [key, townCoords] of Object.entries(MUNICIPALITY_COORDINATES)) {
              if (locationText.includes(key)) {
                coords = townCoords;
                try {
                  localStorage.setItem(
                    "propertyCustomCoords_" + p.property_id,
                    JSON.stringify(townCoords)
                  );
                } catch (e) {}
                break;
              }
            }
          }

          // If still no coords, trigger geocoding right away!
          if (!coords && (p.location || p.property_name)) {
            const query = p.location || p.property_name;
            geocodeAddress(query).then((geo) => {
              if (geo && geo.lat && geo.lng) {
                localStorage.setItem(
                  "propertyCustomCoords_" + p.property_id,
                  JSON.stringify([geo.lat, geo.lng])
                );
              }
            }).catch(() => {});
          }
        }

        return {
          id: p.property_id,
          name: p.property_name || `Property ${p.property_id}`,
          location: p.location,
          coordinates: coords || [10.7372, 122.4998],
          hasLots: propLots.length > 0,
          status: p.status || "active",
        };
      });
    }
    return [];
  }, [mapData]);

  // Pre-cache satellite tiles for all properties in background
  useEffect(() => {
    if (properties && properties.length > 0) {
      preloadAllProperties(properties, mapLayer);
    }
  }, [properties, mapLayer]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, {
                  withCredentials: true,
                });
                return { ...lot, customer: lotDetails.data.customer };
              } catch (error) {
                console.error(`Error fetching customer data for lot ${lot.lot_id}:`, error);
                return lot;
              }
            }
            return lot;
          })
        );

        const finalMapData = { ...mapResponse.data, lots: lotsWithCustomerData };
        setMapData(finalMapData);
        try { sessionStorage.setItem("mapDataCache", JSON.stringify(finalMapData)); } catch (e) {}
      } catch (err) {
        console.error("Map Load Error:", err);
      }
    };

    fetchMapData();
  }, []);

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Auto fallback away from deleted or inactive property to the first active property ONLY when backend data is loaded
  useEffect(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      const exists = mapData.properties.some(
        (p) => p.status !== "inactive" && Number(p.property_id) === Number(selectedProperty)
      );
      if (!exists) {
        const fallbackProp = properties[0];
        if (fallbackProp) {
          setSelectedProperty(fallbackProp.id);
          localStorage.setItem("selectedProperty", fallbackProp.id.toString());
          if (fallbackProp.coordinates) {
            window.dispatchEvent(
              new CustomEvent("selectProperty", {
                detail: { propertyId: fallbackProp.id, coordinates: fallbackProp.coordinates },
              })
            );
          }
        }
      }
    }
  }, [mapData, properties, selectedProperty]);

  // Active property IDs set to exclude lots from inactive properties
  const activePropertyIds = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.properties)) return new Set([1, 2, 3]);
    return new Set(
      mapData.properties
        .filter((p) => p.status !== "inactive")
        .map((p) => Number(p.property_id))
    );
  }, [mapData]);

  // Road & Map Text Annotations across all active properties
  const allPropertyAnnotations = useMemo(() => {
    if (!mapData?.properties) return [];
    const result = [];
    mapData.properties.forEach((p) => {
      if (!p.annotations) return;
      try {
        const parsed =
          typeof p.annotations === "string" ? JSON.parse(p.annotations) : p.annotations;
        if (Array.isArray(parsed)) {
          result.push(...parsed);
        }
      } catch (e) {}
    });
    return result;
  }, [mapData]);

  const createRoadLabelIcon = useCallback((item) => {
    return L.divIcon({
      className: "map-road-label-icon",
      html: `
        <div class="map-road-label-inner" style="
          position: absolute;
          left: 0;
          top: 0;
          transform: translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(var(--road-label-scale, 1));
          transform-origin: center center;
          color: ${item.color || '#ffffff'};
          font-size: ${item.fontSize || 12}px;
          font-weight: 800;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: 0.6px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1);
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        ">
          <span>${item.text || ''}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // Render lots only for active properties
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter((l) => activePropertyIds.has(Number(l.property_id)));
  }, [mapData, activePropertyIds]);

  // Get selected property coordinates
  const selectedPropertyCoords = useMemo(() => {
    const prop = properties.find((p) => p.id === selectedProperty);
    if (prop && prop.coordinates) return prop.coordinates;

    try {
      const custom = localStorage.getItem("propertyCustomCoords_" + selectedProperty);
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch (e) {}

    return [10.7372, 122.4998];
  }, [properties, selectedProperty]);

  // ── Optimization: O(1) status → color lookup ──────────────────────────────
  const STATUS_COLORS = { Available: "#22c55e", Pending: "#eab308", Sold: "#ef4444" };
  const getStatusColor = (status) => STATUS_COLORS[status] || "#94a3b8";

  // ── Optimization: Pre-built icon cache — only 4 icons total, never per-render ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pinIconCache = useMemo(() => {
    const makeIcon = (color) =>
      L.divIcon({
        className: "custom-pin",
        html: `<div style="background-color:${color};width:16px;height:16px;border-radius:50%;border:1px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);cursor:pointer;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
    return {
      Available: makeIcon("#22c55e"),
      Pending: makeIcon("#eab308"),
      Sold: makeIcon("#ef4444"),
      default: makeIcon("#94a3b8"),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPinIcon = (status) => pinIconCache[status] || pinIconCache.default;

  const handleCloseOffcanvas = () => {
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  };

  // Function to refresh map data when lot is updated
  const handleLotUpdated = () => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, {
                  withCredentials: true,
                });
                return { ...lot, customer: lotDetails.data.customer };
              } catch (error) {
                console.error(`Error fetching customer data for lot ${lot.lot_id}:`, error);
                return lot;
              }
            }
            return lot;
          })
        );

        setMapData({ ...mapResponse.data, lots: lotsWithCustomerData });
      } catch (err) {
        console.error("Map Refresh Error:", err);
      }
    };

    fetchMapData();
  };

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div
      ref={mapWrapperRef}
      className={`w-full h-full relative ${currentZoom < 18 ? "map-view-zoomed-out" : "map-view-zoomed-in"}`}
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={properties && properties.length > 0 ? selectedPropertyCoords : [10.90, 122.60]}
        zoom={properties && properties.length > 0 ? 19 : 9}
        zoomDelta={0.5}
        zoomSnap={0.25}
        maxZoom={28}
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
        touchZoom={true}
        tap={false}
        bounceAtZoomLimits={false}
        wheelDebounceTime={40}
        wheelPxPerZoomLevel={140}
        inertia={true}
        inertiaDeceleration={3000}
        inertiaMaxSpeed={1500}
        style={{ height: "100%", width: "100%", zIndex: 1, touchAction: "manipulation" }}
      >
        <MapLocationSearch
          onLocationSelected={(loc) => {
            triggerArrivalPulse(loc.coordinates);
          }}
        />
        <MapLayerControls
          activeLayer={mapLayer}
          onLayerChange={(newLayer) => {
            // Save current map position before layer switch
            const currentCenter = map ? map.getCenter() : null;
            const currentZoomVal = map ? map.getZoom() : null;
            setMapLayer(newLayer);
            localStorage.setItem("preferredMapLayer", newLayer);
            // Restore position after React re-renders the new TileLayer
            if (map && currentCenter && currentZoomVal) {
              setTimeout(() => {
                map.setView([currentCenter.lat, currentCenter.lng], currentZoomVal, { animate: false });
                map.invalidateSize();
              }, 50);
            }
          }}
          mapContainerRef={mapWrapperRef}
        />
        <MapController
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
          triggerArrivalPulse={triggerArrivalPulse}
          properties={properties}
        />
        <ActiveMapTileLayer activeLayer={mapLayer} />

        {/* ── Single Map-Level Controlled Popup for Tablet Touch Devices ── */}
        {activePopupLot && (
          <Popup
            position={activePopupLot.position}
            onClose={() => setActivePopupLot(null)}
            className="lot-preview-touch-popup"
            autoPan={false}
            offset={[0, -10]}
          >
            <div style={{ minWidth: "140px", padding: "2px" }} className="text-center">
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>
                {activePopupLot.lot_number}
              </div>
              <div style={{ fontSize: "11.5px", color: "#475569", marginBottom: "6px" }}>
                {activePopupLot.area_sqm} sqm
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: `${activePopupLot.statusColor}22`,
                  color: activePopupLot.statusColor,
                  marginBottom: (activePopupLot.status === "Pending" || activePopupLot.status === "Sold") && activePopupLot.customer ? "4px" : "8px",
                }}
              >
                {activePopupLot.status}
              </div>

              {(activePopupLot.status === "Pending" || activePopupLot.status === "Sold") && activePopupLot.customer && (
                <div
                  style={{
                    marginTop: "4px",
                    marginBottom: "8px",
                    paddingTop: "6px",
                    borderTop: "1px solid #e2e8f0",
                    fontSize: "11px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#334155", marginBottom: "2px" }}>Customer Info:</div>
                  <div style={{ color: "#0f172a", fontWeight: 500 }}>{activePopupLot.customer.full_name || "N/A"}</div>
                  <div style={{ color: "#64748b", fontSize: "10.5px", wordBreak: "break-all" }}>{activePopupLot.customer.email || "N/A"}</div>
                  <div style={{ color: "#64748b", fontSize: "10.5px" }}>{activePopupLot.customer.contact_number || "N/A"}</div>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const matchingProp = properties.find(
                    (p) => Number(p.id) === Number(activePopupLot.property_id || selectedProperty)
                  );
                  const propName = matchingProp?.name || matchingProp?.property_name || "Golden Dragon Estate";
                  const propLocation = matchingProp?.location || matchingProp?.name || "Guimbal, Iloilo";

                  setSelectedLot({
                    ...activePopupLot,
                    property_name: activePopupLot.property_name || propName,
                    location: activePopupLot.location || propLocation,
                  });
                  setIsOffcanvasOpen(true);
                  setActivePopupLot(null);

                  axios.get(`${API_BASE_URL}/api/lots/${activePopupLot.lot_id}`, { withCredentials: true })
                    .then((res) => {
                      setSelectedLot(prev => prev && prev.lot_id === activePopupLot.lot_id ? { ...prev, ...res.data } : prev);
                    }).catch(() => {});
                }}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
                }}
              >
                <span>View Details</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </Popup>
        )}

        {/* ── Zoomed-Out Overview Green Property Location Beacons (CSS visibility) ── */}
        {properties.map((property) => {
          if (!property.coordinates || !Array.isArray(property.coordinates) || property.coordinates.length < 2) return null;
          return (
            <Marker
              key={`overview-prop-${property.id}`}
              position={property.coordinates}
              icon={createOverviewPropertyIcon(property.name, property.lotCount || 0)}
              eventHandlers={{
                click: (e) => {
                  if (e?.originalEvent) {
                    e.originalEvent.stopPropagation();
                  }
                  setSelectedProperty(property.id);
                  localStorage.setItem("selectedProperty", property.id.toString());
                  window.dispatchEvent(
                    new CustomEvent("selectProperty", {
                      detail: { propertyId: property.id, coordinates: property.coordinates },
                    })
                  );
                },
              }}
            />
          );
        })}



        {filteredLots.map((lot) => {
          // Skip lots with invalid or missing coordinates
          if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
            console.warn(
              `Lot ${lot.lot_id} (${lot.lot_number}) has invalid coordinates, skipping...`
            );
            return null;
          }

          const lats = lot.coordinates.map((c) => c[0]);
          const lngs = lot.coordinates.map((c) => c[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          const statusColor = getStatusColor(lot.status);

          const isTouchDevice =
            typeof window !== "undefined" &&
            (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
              ("ontouchstart" in window && window.innerWidth < 1100));

          const openFullLotDetails = async () => {
            const matchingProp = properties.find(
              (p) => Number(p.id) === Number(lot.property_id || selectedProperty)
            );
            const propName = matchingProp?.name || matchingProp?.property_name || "Golden Dragon Estate";
            const propLocation = matchingProp?.location || matchingProp?.name || "Guimbal, Iloilo";

            // Set basic lot data immediately with property details attached
            setSelectedLot({
              ...lot,
              property_name: lot.property_name || propName,
              location: lot.location || propLocation,
            });
            setIsOffcanvasOpen(true);

            // Then fetch fresh data in background
            try {
              const lotDetails = await axios.get(
                `${API_BASE_URL}/api/lots/${lot.lot_id}`,
                { withCredentials: true }
              );
              setSelectedLot({
                ...lotDetails.data,
                property_name: lotDetails.data.property_name || propName,
                location: lotDetails.data.location || propLocation,
              });
            } catch (error) {
              console.error("Error fetching customer data:", error);
            }
          };

          const handleLotClick = (e) => {
            if (e?.originalEvent) {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
            }
            // On desktop (mouse), clicking immediately opens the full sidebar
            if (!isTouchDevice) {
              openFullLotDetails();
            } else {
              setActivePopupLot({
                ...lot,
                position: [centerLat, centerLng],
                statusColor,
              });
            }
          };

          return (
            <React.Fragment key={`emp-lot-node-${lot.lot_id}-${lot.status}`}>
              <Polygon
                key={`emp-poly-${lot.lot_id}-${lot.status}`}
                positions={lot.coordinates}
                pathOptions={{
                  color: statusColor,
                  fillColor: statusColor,
                  fillOpacity: 0.6,
                  weight: 2,
                }}
                eventHandlers={{
                  click: handleLotClick,
                }}
              />

              <Marker
                key={`emp-pin-${lot.lot_id}-${lot.status}-${centerLat.toFixed(6)}-${centerLng.toFixed(6)}`}
                position={[centerLat, centerLng]}
                icon={createPinIcon(lot.status)}
                eventHandlers={{
                  click: handleLotClick,
                }}
              >
                {!isTouchDevice && currentZoom >= 19 && (
                  <Tooltip
                    permanent={false}
                    direction="top"
                    offset={[0, -18]}
                    sticky={false}
                    interactive={false}
                    opacity={0.95}
                  >
                    <div className="text-center text-xs leading-tight">
                      <div className="mb-1 font-bold text-slate-900">{lot.lot_number}</div>
                      <div className="mb-1 text-[12px] text-gray-600">{lot.area_sqm} sqm</div>
                      <div className="mb-1 text-[12px] font-bold" style={{ color: statusColor }}>
                        {lot.status}
                      </div>
                      {(lot.status === "Pending" || lot.status === "Sold") && lot.customer && (
                        <>
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <div className="text-[11px] text-gray-700">
                              <div className="font-semibold">Customer Info:</div>
                              <div>{lot.customer.full_name || "N/A"}</div>
                              <div className="text-gray-600">{lot.customer.email || "N/A"}</div>
                              <div className="text-gray-600">
                                {lot.customer.contact_number || "N/A"}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Tooltip>
                )}
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── Road & Map Text Annotations (Only rendered when zoomed in super close at 19.5+) ── */}
        {currentZoom >= 19.5 &&
          allPropertyAnnotations.map((item) => (
            <Marker
              key={item.id}
              position={[item.lat, item.lng]}
              icon={createRoadLabelIcon(item)}
              interactive={false}
            />
          ))}
      </MapContainer>

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        isAdmin={false}
        selectedLot={selectedLot}
        propertyName={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.property_name ||
          "Golden Dragon Estate"
        }
        propertyLocation={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.location ||
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.location ||
          "Guimbal, Iloilo"
        }
        isOpen={isOffcanvasOpen}
        onClose={handleCloseOffcanvas}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
      />
    </div>
  );
};

export default EmployeeMapView;
