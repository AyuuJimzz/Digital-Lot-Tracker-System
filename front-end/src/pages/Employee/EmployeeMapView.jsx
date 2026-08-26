import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";

import {
  MapContainer,
  Polygon,
  Popup,
  useMap,
  Marker,
  Polyline,
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
import { geocodeAddress } from "../../utils/geocoding";

import "leaflet/dist/leaflet.css";

const DEFAULT_COORDINATES_MAP = {
  1: [10.7372, 122.4998], // LOT-3896 Oton Cadastre
  2: [10.737956, 122.505478], // Lot-2018 Oton Cadestra
  3: [10.671313, 122.335284], // Lot-204 Nanga Guimbal
};

const MUNICIPALITY_COORDINATES = {
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7372, 122.4998],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "pavia": [10.7744, 122.5408],
  "santa barbara": [10.8242, 122.5342],
  "leganes": [10.7833, 122.5833],
  "dumangas": [10.8250, 122.7167],
  "zarraga": [10.8217, 122.6108],
  "pototan": [10.9472, 122.6289],
  "janiuay": [10.9575, 122.5022],
  "miagao": [10.6444, 122.2358],
  "san joaquin": [10.5878, 122.1408],
  "tigbauan": [10.6756, 122.3811],
  "iloilo": [10.7202, 122.5621],
  "passi": [11.1075, 122.6419],
};

// ── Lightweight Static Overview Location Beacon (no animation = no GPU stutter) ──
const createOverviewPropertyIcon = (name, lotCount) => {
  return L.divIcon({
    className: "property-overview-beacon-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translate(-50%,-100%);pointer-events:none;">
        <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#10b981,#047857);border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,0.3),0 3px 8px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;">
          <svg width="13" height="13" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
        <div style="margin-top:3px;background:rgba(15,23,42,0.88);border:1px solid rgba(16,185,129,0.7);padding:2px 8px;border-radius:9999px;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          <span style="width:5px;height:5px;border-radius:50%;background:#34d399;display:inline-block;flex-shrink:0;"></span>
          <span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:0.2px;">${name}</span>
          ${lotCount > 0 ? `<span style="color:#6ee7b7;font-size:10px;font-weight:600;">(${lotCount})</span>` : ""}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

function MapController({
  setSelectedProperty,
  setMap,
  setCurrentZoom,
  triggerArrivalPulse,
  properties,
}) {
  const map = useMap();

  useEffect(() => {
    if (setMap) setMap(map);
    if (setCurrentZoom) setCurrentZoom(map.getZoom());

    // Only update on zoomend (not every frame) to avoid flood of React re-renders
    let debounceTimer;
    const handleZoomEnd = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (setCurrentZoom) setCurrentZoom(map.getZoom());
      }, 80);
    };
    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
      clearTimeout(debounceTimer);
    };
  }, [map, setMap, setCurrentZoom]);

  // Ensure map recalculates its exact full-screen dimensions to prevent grey/unrendered tiles
  useEffect(() => {
    if (!map) return;
    map.invalidateSize();

    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  // Initial subtle smooth cinematic zoom-out animation when opening Map View
  useEffect(() => {
    if (!map) return;
    const initialCenter = map.getCenter();
    const t = setTimeout(() => {
      map.flyTo(initialCenter, 18.2, { duration: 1.4, easeLinearity: 0.25 });
    }, 200);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    // Listen for property navigation events with smooth zoom out / glide flyTo animation
    const handleNavigateToProperty = (event) => {
      const { coordinates } = event.detail;

      // Validate coordinates before setting map view
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.error("Invalid coordinates for navigation:", coordinates);
        return;
      }

      map.stop();
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const dist = Math.hypot(
        currentCenter.lat - coordinates[0],
        currentCenter.lng - coordinates[1]
      );

      // If already viewing this location, toggle subtle zoom out (18) or zoom in (19)
      if (dist < 0.002) {
        if (currentZoom >= 18.8) {
          map.flyTo(coordinates, 18, { duration: 1.0, easeLinearity: 0.25 });
        } else {
          map.flyTo(coordinates, 19.2, { duration: 1.0, easeLinearity: 0.25 });
        }
      } else {
        // Direct smooth cinematic glide straight to target coordinates
        const duration = dist < 0.01 ? 1.2 : 1.8;
        map.flyTo(coordinates, 18.5, { duration, easeLinearity: 0.25 });
      }

      // Only show arrival pulse beacon if the target location has NO lots yet
      const targetProp = properties.find(
        (p) =>
          p.coordinates &&
          Math.hypot(p.coordinates[0] - coordinates[0], p.coordinates[1] - coordinates[1]) < 0.005
      );
      if (targetProp && !targetProp.hasLots && triggerArrivalPulse) {
        triggerArrivalPulse(coordinates);
      }
    };

    // Listen for toggle zoom out / in when clicking Map View
    const handleToggleMapOverview = () => {
      if (!map) return;
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      if (currentZoom >= 18.8) {
        map.flyTo(currentCenter, 18, { duration: 1.2, easeLinearity: 0.25 });
      } else {
        map.flyTo(currentCenter, 19.2, { duration: 1.2, easeLinearity: 0.25 });
      }
    };

    // Listen for property selection events
    const handleSelectProperty = (event) => {
      const { propertyId } = event.detail;
      setSelectedProperty(propertyId);
    };

    window.addEventListener("navigateToProperty", handleNavigateToProperty);
    window.addEventListener("toggleMapOverview", handleToggleMapOverview);
    window.addEventListener("selectProperty", handleSelectProperty);

    return () => {
      window.removeEventListener("navigateToProperty", handleNavigateToProperty);
      window.removeEventListener("toggleMapOverview", handleToggleMapOverview);
      window.removeEventListener("selectProperty", handleSelectProperty);
    };
  }, [map, setSelectedProperty, triggerArrivalPulse, properties]);

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

  const [selectedProperty, setSelectedProperty] = useState(() => {
    const savedProperty = localStorage.getItem("selectedProperty");
    return savedProperty ? parseInt(savedProperty) : 1;
  });

  // Temporary auto-fading pulse indicator for property/location arrival
  const [pulseCoords, setPulseCoords] = useState(null);
  const pulseTimerRef = useRef(null);

  const triggerArrivalPulse = useCallback((coords) => {
    if (!coords || !Array.isArray(coords) || coords.length < 2) return;
    setPulseCoords(coords);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setPulseCoords(null);
    }, 3500);
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
    return [
      { id: 1, name: "LOT-3896 Oton Cadastre", coordinates: [10.7372, 122.4998] },
      { id: 2, name: "Lot-2018 Oton Cadestra", coordinates: [10.737956, 122.505478] },
      { id: 3, name: "Lot-204 Nanga Guimbal", coordinates: [10.671313, 122.335284] },
    ];
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

  const prevPropertyRef = useRef(null);

  // Center map on selected property with cinematic zoom-out → glide → zoom-in animation
  useEffect(() => {
    if (!map || !selectedProperty || properties.length === 0) return;

    if (prevPropertyRef.current !== selectedProperty) {
      prevPropertyRef.current = selectedProperty;
      const target = properties.find((p) => p.id === selectedProperty);
      if (target && target.coordinates) {
        // Only show arrival blue pulse if the property has NO lots yet
        if (!target.hasLots && triggerArrivalPulse) {
          triggerArrivalPulse(target.coordinates);
        }
        const timer = setTimeout(() => {
          map.stop();
          const currentCenter = map.getCenter();
          const dist = Math.hypot(
            currentCenter.lat - target.coordinates[0],
            currentCenter.lng - target.coordinates[1]
          );

          if (dist < 0.002) {
            map.flyTo(target.coordinates, 18.5, { duration: 1.0, easeLinearity: 0.25 });
          } else {
            // Direct smooth cinematic glide straight to target property
            const duration = dist < 0.01 ? 1.2 : 1.8;
            map.flyTo(target.coordinates, 18.5, { duration, easeLinearity: 0.25 });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedProperty, properties, map, currentZoom, triggerArrivalPulse]);

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Lots belonging to currently selected property
  const selectedPropertyLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter(
      (l) => l.property_id === selectedProperty && l.coordinates && l.coordinates.length > 0
    );
  }, [mapData, selectedProperty]);

  // ── Optimization: Only render lots for the SELECTED property ──────────────
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter(
      (l) => l.property_id === selectedProperty
    );
  }, [mapData, selectedProperty]);

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
      className="w-full h-full relative"
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={selectedPropertyCoords}
        zoom={19}
        maxZoom={21}
        zoomControl={false}
        attributionControl={false}
        preferCanvas={true}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
        touchZoom={true}
        tap={false}
        bounceAtZoomLimits={false}
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
          setSelectedProperty={setSelectedProperty}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
          triggerArrivalPulse={triggerArrivalPulse}
          properties={properties}
        />
        <ActiveMapTileLayer activeLayer={mapLayer} />

        {/* ── Zoomed-Out Overview Green Property Location Beacons (< 17 zoom) ── */}
        {currentZoom < 17 &&
          properties.map((property) => {
            if (!property.coordinates || !Array.isArray(property.coordinates) || property.coordinates.length < 2) return null;
            // Hide green beacon for selected property — user is already there
            if (property.id === selectedProperty) return null;
            return (
              <Marker
                key={`overview-prop-${property.id}`}
                position={property.coordinates}
                icon={createOverviewPropertyIcon(property.name, property.lotCount || 0)}
                eventHandlers={{
                  click: () => {
                    setSelectedProperty(property.id);
                    if (map) {
                      map.flyTo(property.coordinates, 18.5, { duration: 1.5, easeLinearity: 0.25 });
                    }
                  },
                }}
              />
            );
          })}

        {/* ── Temporary Auto-Fading Royal Blue GPS Radar Signal Beacon (Only when property has NO lots) ── */}
        {pulseCoords && selectedPropertyLots.length === 0 && (
          <Marker
            position={pulseCoords}
            icon={L.divIcon({
              className: "arrival-blue-signal-indicator",
              html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; pointer-events: none;">
                  <div style="position: absolute; width: 62px; height: 62px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.45); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.35); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 0.35s;"></div>
                  <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 0 20px rgba(59, 130, 246, 0.95), 0 4px 12px rgba(0,0,0,0.45);">
                    <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                </div>
              `,
              iconSize: [64, 64],
              iconAnchor: [32, 32],
            })}
          />
        )}

        {filteredLots.map((lot) => {
          // Skip lots with invalid or missing coordinates
          if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
            console.warn(
              `Lot ${lot.lot_id} (${lot.lot_number}) has invalid coordinates, skipping...`
            );
            return null;
          }

          const centerLat =
            lot.coordinates.reduce((sum, coord) => sum + coord[0], 0) / lot.coordinates.length;
          const centerLng =
            lot.coordinates.reduce((sum, coord) => sum + coord[1], 0) / lot.coordinates.length;
          const pinLat = centerLat + 0.00012;
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
            // On desktop (mouse), clicking immediately opens the full sidebar
            if (!isTouchDevice) {
              if (e?.originalEvent) {
                e.originalEvent.stopPropagation();
                e.originalEvent.preventDefault();
              }
              openFullLotDetails();
            }
            // On tablet/touchscreen: default event allows Leaflet to open the Quick Preview Popup!
          };

          const renderLotPopup = () => {
            if (!isTouchDevice) return null;
            return (
              <Popup className="lot-preview-touch-popup" autoPan={false} offset={[0, -10]}>
                <div style={{ minWidth: "150px", padding: "2px" }} className="text-center">
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                    Lot ID: {lot.lot_id}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                    {lot.lot_number}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#475569", marginBottom: "6px" }}>
                    {lot.area_sqm} sqm
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: `${statusColor}22`,
                      color: statusColor,
                      marginBottom: "8px",
                    }}
                  >
                    {lot.status}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFullLotDetails();
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
            );
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
              >
                {renderLotPopup()}
              </Polygon>

              {currentZoom >= 17 && (
                <>
                  <Polyline
                    key={`emp-line-${lot.lot_id}-${centerLat}-${centerLng}`}
                    positions={[
                      [centerLat, centerLng],
                      [pinLat, centerLng],
                    ]}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 1,
                      dashArray: "2, 4",
                      opacity: 0.7,
                    }}
                  />

                  <Marker
                    key={`emp-pin-${lot.lot_id}-${lot.status}-${centerLat.toFixed(6)}-${centerLng.toFixed(6)}`}
                    position={[pinLat, centerLng]}
                    icon={createPinIcon(lot.status)}
                    eventHandlers={{
                      click: handleLotClick,
                    }}
                  >
                    {renderLotPopup()}
                    <Tooltip permanent={false} direction="top" offset={[0, -32]}>
                      <div className="text-center text-xs leading-tight">
                        <div className="mb-1 font-bold">Lot ID: {lot.lot_id}</div>
                        <div className="mb-1 font-bold">{lot.lot_number}</div>
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
                  </Marker>
                </>
              )}
            </React.Fragment>
          );
        })}
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
