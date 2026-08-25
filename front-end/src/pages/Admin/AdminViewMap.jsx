import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";

import {
  MapContainer,
  Polygon,
  Popup,
  useMap,
  Marker,
  Polyline,
  Tooltip,
  ImageOverlay,
} from "react-leaflet";
import axios from "axios";
import L from "leaflet";
import LotOffcanvas from "../../components/admin/LotOffcanvas";
import { ImageOverlayControl } from "../../components/admin/ImageOverlayControl";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import {
  MapLayerControls,
  ActiveMapTileLayer,
  MAP_LAYERS,
} from "../../components/admin/MapLayerControls";
import { preloadAllProperties } from "../../utils/tilePreloader";
import { geocodeAddress } from "../../utils/geocoding";

// Fix for default icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

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

// Component to handle map centering and event listening
function MapController({
  center,
  onLotUpdated,
  setSelectedProperty,
  triggerArrivalPulse,
  setMap,
  setCurrentZoom,
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
    // Listen for property navigation events
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

      if (triggerArrivalPulse) {
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
  }, [map, setSelectedProperty, triggerArrivalPulse]);

  useEffect(() => {
    // Remove automatic centering to prevent map movement when offcanvas opens
    // Map will only move when user explicitly navigates to a property
    return () => {};
  }, [center, map]);

  return null;
}

function AdminViewMap() {
  const [mapData, setMapData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("mapDataCache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [map, setMap] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(19);
  const mapWrapperRef = useRef(null);
  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem("preferredMapLayer") || MAP_LAYERS.SATELLITE;
  });
  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    return parseInt(localStorage.getItem("selectedProperty")) || 1;
  });

  // Temporary auto-fading pulse indicator for property/location arrival
  const [pulseCoords, setPulseCoords] = useState(null);
  const pulseTimerRef = React.useRef(null);

  const triggerArrivalPulse = useCallback((coords) => {
    if (!coords || !Array.isArray(coords) || coords.length < 2) return;
    setPulseCoords(coords);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setPulseCoords(null);
    }, 3500); // Disappears automatically after 3.5 seconds once arrived
  }, []);

  // States for visual coordinate editing
  const [editingLot, setEditingLot] = useState(null);
  const [editingCoords, setEditingCoords] = useState([]);
  const [isSavingCoords, setIsSavingCoords] = useState(false);

  // State and Ref for dragging the entire polygon
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const polygonDragRef = React.useRef(null);
  const draggedCoordsRef = React.useRef(null); // stores coordinates temporarily during bulk polygon drag

  // Refs for smooth vertex dragging
  const editingPolygonRef = React.useRef(null);
  const dragCoordsRef = React.useRef([]);
  const cornerMarkersRef = React.useRef([]); // stores refs to Leaflet Marker instances for direct DOM positioning during drag

  // ── Image Overlay States ──────────────────────────────────────────────────
  const [overlayImage, setOverlayImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null); // [[sw_lat, sw_lng], [ne_lat, ne_lng]]
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [overlayRotation, setOverlayRotation] = useState(0); // degrees
  const overlayRef = React.useRef(null);
  const overlayMoveStartRef = React.useRef(null);
  const overlayCornerDragRef = React.useRef(null); // stores {initBounds, currentBounds} during corner drag

  // ── Bulk Shift States ──────────────────────────────────────────────────────
  const [isBulkShifting, setIsBulkShifting] = useState(false);
  const [bulkShiftOffset, setBulkShiftOffset] = useState({ lat: 0, lng: 0 });
  const bulkShiftStartRef = React.useRef(null);

  // Handle moving a vertex on drag (updates Leaflet instance directly for performance/smoothness)
  const handleVertexDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    const currentCoords = dragCoordsRef.current;
    if (currentCoords && currentCoords.length > index) {
      currentCoords[index] = [lat, lng];
      if (editingPolygonRef.current) {
        editingPolygonRef.current.setLatLngs(currentCoords);
      }
    }
  };

  // Sync back to React state only when dragging finishes
  const handleVertexDragEnd = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    setEditingCoords((prev) => {
      const newCoords = [...prev];
      newCoords[index] = [lat, lng];
      return newCoords;
    });
  };

  // Remove a vertex by index (triggered by double-clicking a corner handle)
  const handleRemoveVertex = (index) => {
    if (editingCoords.length <= 3) {
      alert("A polygon must have at least 3 corners.");
      return;
    }
    setEditingCoords((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add a new vertex at a specific index
  const handleAddVertexAtIndex = (insertIndex, position) => {
    setEditingCoords((prev) => {
      const newCoords = [...prev];
      newCoords.splice(insertIndex, 0, position);
      return newCoords;
    });
  };

  // Calculate midpoints of all edges of the polygon to add new corners
  const midpointHandles = useMemo(() => {
    if (!editingCoords || editingCoords.length < 3) return [];
    const midpoints = [];
    const n = editingCoords.length;
    for (let i = 0; i < n; i++) {
      const p1 = editingCoords[i];
      const p2 = editingCoords[(i + 1) % n];
      const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      midpoints.push({
        position: mid,
        insertIndex: i + 1,
      });
    }
    return midpoints;
  }, [editingCoords]);

  // Create a small '+' icon for the midpoint handles
  const createMidpointIcon = () => {
    return L.divIcon({
      className: "custom-midpoint-icon",
      html: `
        <div style="
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background-color: rgba(16, 185, 129, 0.85);
          border: 1.5px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          line-height: 1;
          transition: transform 0.15s ease-in-out;
        " onmouseover="this.style.transform='scale(1.2)';" onmouseout="this.style.transform='scale(1)';">
          +
        </div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  };

  // Create a handle icon for the draggable vertices
  const createHandleIcon = (index) => {
    return L.divIcon({
      className: "custom-handle-icon",
      html: `
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: move;
        ">
          <!-- Dashed outer ring for visibility and dragging target area -->
          <div style="
            position: absolute;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 1.5px dashed #10b981;
            background-color: rgba(16, 185, 129, 0.15);
            pointer-events: none;
          "></div>
          
          <!-- Exact center point (vertex) -->
          <div style="
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #10b981;
            border: 2px solid #ffffff;
            box-shadow: 0 0 3px rgba(0,0,0,0.5);
            pointer-events: none;
            z-index: 2;
          "></div>
          
          <!-- Corner number label (offset to top-right) -->
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background-color: #047857;
            color: #ffffff;
            font-size: 8px;
            font-weight: bold;
            min-width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            z-index: 3;
            pointer-events: none;
          ">
            ${index + 1}
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  // Create amber corner handle icon for overlay alignment
  const createOverlayCornerIcon = useCallback((label) => {
    return L.divIcon({
      className: "overlay-corner-icon",
      html: `
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background-color: #f59e0b;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: move;
          color: #ffffff;
          font-size: 7px;
          font-weight: bold;
          letter-spacing: -0.5px;
        ">${label}</div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }, []);

  // ── Overlay corner drag — no React re-render during drag ────────────────
  const handleOverlayCornerDragStart = useCallback(
    (currentBounds) => {
      console.log("Corner drag start. Current bounds:", currentBounds);
      if (map) map.dragging.disable();
      overlayCornerDragRef.current = currentBounds.map((c) => [...c]);
    },
    [map]
  );

  const handleOverlayCornerDrag = useCallback((corner, e) => {
    if (!overlayCornerDragRef.current || !overlayRef.current) {
      console.log("Corner drag ignored. Ref current or overlayRef null:", {
        ref: !!overlayCornerDragRef.current,
        overlay: !!overlayRef.current,
      });
      return;
    }
    const { lat, lng } = e.target.getLatLng();
    const [sw, ne] = overlayCornerDragRef.current;
    let newBounds;
    switch (corner) {
      case "sw":
        newBounds = [[lat, lng], ne];
        break;
      case "se":
        newBounds = [
          [lat, sw[1]],
          [ne[0], lng],
        ];
        break;
      case "ne":
        newBounds = [sw, [lat, lng]];
        break;
      case "nw":
        newBounds = [
          [sw[0], lng],
          [lat, ne[1]],
        ];
        break;
      default:
        return;
    }
    console.log(`Corner drag (${corner}) to:`, newBounds);
    overlayCornerDragRef.current = newBounds;
    overlayRef.current.setBounds(newBounds); // Direct Leaflet — zero React re-render
  }, []);

  const handleOverlayCornerDragEnd = useCallback(() => {
    console.log("Corner drag end. Final bounds to set:", overlayCornerDragRef.current);
    if (map) map.dragging.enable();
    if (overlayCornerDragRef.current) {
      setOverlayBounds(overlayCornerDragRef.current); // Sync to React state once on drop
      overlayCornerDragRef.current = null;
    }
  }, [map]);

  // Handle image upload — place overlay centered on current map view
  const handleImageUpload = useCallback(
    (imageUrl) => {
      if (overlayImage) URL.revokeObjectURL(overlayImage);
      setOverlayImage(imageUrl);
      setOverlayVisible(true);
      setIsEditingOverlay(true); // auto-enter alignment mode

      if (map) {
        const bounds = map.getBounds();
        const latSpan = (bounds.getNorth() - bounds.getSouth()) * 0.7;
        const lngSpan = (bounds.getEast() - bounds.getWest()) * 0.7;
        const center = map.getCenter();
        setOverlayBounds([
          [center.lat - latSpan / 2, center.lng - lngSpan / 2],
          [center.lat + latSpan / 2, center.lng + lngSpan / 2],
        ]);
      } else {
        // Fallback: center on Property 1's default coordinates
        const fallback = [10.7372, 122.4998];
        const offset = 0.003;
        setOverlayBounds([
          [fallback[0] - offset, fallback[1] - offset],
          [fallback[0] + offset, fallback[1] + offset],
        ]);
      }
    },
    [map, overlayImage]
  );

  // Apply CSS rotation — extracted so we can call it both on mount and on slider change
  const applyRotation = useCallback((deg) => {
    if (overlayRef.current && overlayRef.current._image) {
      const img = overlayRef.current._image;
      img.style.transformOrigin = "center center";
      img.style.rotate = `${deg}deg`; // Use modern CSS rotate property to avoid resetting Leaflet's transform position
    }
  }, []);

  // Re-apply rotation when the ImageOverlay remounts (url/bounds change recreates the DOM node)
  useEffect(() => {
    applyRotation(overlayRotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayImage, overlayBounds, applyRotation]);

  // Fit overlay to current map view
  const handleFitToView = useCallback(() => {
    if (!map) return;
    const b = map.getBounds();
    setOverlayBounds([
      [b.getSouth(), b.getWest()],
      [b.getNorth(), b.getEast()],
    ]);
  }, [map]);

  // Create bulk shift controller crosshair icon
  const createBulkShiftCenterIcon = useCallback(() => {
    return L.divIcon({
      className: "bulk-shift-center-icon",
      html: `
        <div style="width:44px;height:44px;border-radius:50%;background-color:rgba(220,38,38,0.9);border:3px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;cursor:move;">
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M12 2v20M2 12h20M12 2l-3 3h6l-3-3zm0 20l-3-3h6l-3 3zM2 12l3-3v6l-3-3zm20 0l-3-3v6l3-3z"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, []);

  // Save bulk shifted coordinates to database
  const handleSaveBulkShift = async () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setIsBulkShifting(false);
      return;
    }

    if (!window.confirm(`Are you sure you want to shift all lots for this property?`)) {
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/api/lots/property/${selectedProperty}/bulk-shift`, {
        deltaLat: bulkShiftOffset.lat,
        deltaLng: bulkShiftOffset.lng,
      });

      alert("All lots shifted and aligned successfully!");
      // Reload map data to get fresh coordinates from database
      handleLotUpdated();
      setIsBulkShifting(false);
      setBulkShiftOffset({ lat: 0, lng: 0 });
    } catch (err) {
      console.error("Error bulk shifting lots:", err);
      alert(err.response?.data?.error || "Failed to bulk shift lots");
    }
  };

  // Create purple center-move icon
  const createOverlayCenterIcon = useCallback(() => {
    return L.divIcon({
      className: "overlay-center-icon",
      html: `
        <div style="
          width: 30px; height: 30px; border-radius: 50%;
          background-color: #7c3aed;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          cursor: move;
        ">
          <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
            <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-13 4h-4v3H3l5 5 5-5h-3v-3z"/>
          </svg>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }, []);

  // Property locations (dynamically derived from mapData or fallback)
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties.map((p) => {
        let coords = DEFAULT_COORDINATES_MAP[p.property_id];
        // If property has lots, calculate the center of its lots
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
          // Check if custom geocoded coordinates were stored for this new property
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
        };
      });
    }
    return [
      { id: 1, name: "LOT-3896 Oton Cadastre", coordinates: [10.7372, 122.4998], hasLots: true },
      { id: 2, name: "Lot-2018 Oton Cadestra", coordinates: [10.737956, 122.505478], hasLots: true },
      { id: 3, name: "Lot-204 Nanga Guimbal", coordinates: [10.671313, 122.335284], hasLots: true },
    ];
  }, [mapData]);

  // Pre-cache satellite tiles for all properties in background
  useEffect(() => {
    if (properties && properties.length > 0) {
      preloadAllProperties(properties, mapLayer);
    }
  }, [properties, mapLayer]);

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  const prevPropertyRef = useRef(null);

  // Center map on selected property with cinematic zoom-out → glide → zoom-in animation
  useEffect(() => {
    if (!map || !selectedProperty || properties.length === 0) return;
    if (editingLot) return; // Do not pull screen away while actively editing or adding a lot!

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
  }, [selectedProperty, properties, map, editingLot, triggerArrivalPulse]);

  // ── Optimization: Only render lots for the SELECTED property ──────────────
  // Rendering all lots from every property at once is the biggest cause of lag.
  // Lots from other properties are still visible via the overview beacons at zoom < 17.
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter(
      (l) => l.property_id === selectedProperty
    );
  }, [mapData, selectedProperty]);

  // Lots belonging to currently selected property
  const selectedPropertyLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter(
      (l) => l.property_id === selectedProperty && l.coordinates && l.coordinates.length > 0
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
  const STATUS_COLORS = {
    Available: "#22c55e",
    Pending: "#eab308",
    Sold: "#ef4444",
  };
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
  }, []); // created once, never recreated

  const createPinIcon = (status) => pinIconCache[status] || pinIconCache.default;

  // Fetch map data
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
        console.error("Map Data Error:", err);
      }
    };

    fetchMapData();
  }, []);

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

        const finalMapData = { ...mapResponse.data, lots: lotsWithCustomerData };
        setMapData(finalMapData);
        try { sessionStorage.setItem("mapDataCache", JSON.stringify(finalMapData)); } catch (e) {}
      } catch (err) {
        console.error("Map Refresh Error:", err);
      }
    };

    fetchMapData();
  };

  // Listen for coordinate updates from AdminHeader
  useEffect(() => {
    const handleRefreshMapData = () => {
      handleLotUpdated();
    };

    window.addEventListener("refreshMapData", handleRefreshMapData);

    return () => {
      window.removeEventListener("refreshMapData", handleRefreshMapData);
    };
  }, []);

  // Listen for openOverlayPanel event from AdminHeader
  useEffect(() => {
    const handleOpenOverlay = () => setShowOverlayPanel(true);
    window.addEventListener("openOverlayPanel", handleOpenOverlay);
    return () => window.removeEventListener("openOverlayPanel", handleOpenOverlay);
  }, []);

  // Listen for start visual edit event
  useEffect(() => {
    const handleStartVisualEdit = (event) => {
      const { lot_id, lot_number, property_id, coordinates } = event.detail;
      setEditingLot({ lot_id, lot_number, property_id });

      if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
        // Deep copy
        setEditingCoords(coordinates.map((c) => [...c]));
      } else {
        // Use current active map center if available so coordinates appear exactly where user is focused
        const currentCenter = map ? map.getCenter() : null;
        const baseCoords =
          currentCenter
            ? [currentCenter.lat, currentCenter.lng]
            : properties.find((p) => Number(p.id) === Number(property_id))?.coordinates ||
              selectedPropertyCoords;

        const offset = 0.00015;
        // Make a square centered at current view coordinates
        setEditingCoords([
          [baseCoords[0] - offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] + offset],
          [baseCoords[0] - offset, baseCoords[1] + offset],
        ]);
      }
    };

    window.addEventListener("startVisualEdit", handleStartVisualEdit);
    return () => {
      window.removeEventListener("startVisualEdit", handleStartVisualEdit);
    };
  }, [map, properties, selectedPropertyCoords]);

  // Handle dragging the entire polygon shape
  useEffect(() => {
    if (!map) return;

    const handleMapMouseMove = (e) => {
      if (!isDraggingPolygon || !polygonDragRef.current) return;

      const { startLatLng, initialCoords } = polygonDragRef.current;
      const currentLatLng = e.latlng;

      const deltaLat = currentLatLng.lat - startLatLng.lat;
      const deltaLng = currentLatLng.lng - startLatLng.lng;

      const newCoords = initialCoords.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng]);

      // Direct Leaflet element updates for buttery smooth 60 FPS movement
      if (editingPolygonRef.current) {
        editingPolygonRef.current.setLatLngs(newCoords);
      }

      if (cornerMarkersRef.current) {
        cornerMarkersRef.current.forEach((marker, index) => {
          if (marker && newCoords[index]) {
            marker.setLatLng(newCoords[index]);
          }
        });
      }

      // Store in ref to retrieve on mouseup
      draggedCoordsRef.current = newCoords;
    };

    const handleMapMouseUp = () => {
      if (isDraggingPolygon) {
        setIsDraggingPolygon(false);
        polygonDragRef.current = null;
        if (map) {
          map.dragging.enable();
        }

        // Sync back to React state only once on mouse release
        if (draggedCoordsRef.current) {
          setEditingCoords(draggedCoordsRef.current);
          draggedCoordsRef.current = null;
        }
      }
    };

    if (isDraggingPolygon) {
      map.on("mousemove", handleMapMouseMove);
      map.on("mouseup", handleMapMouseUp);
    }

    return () => {
      map.off("mousemove", handleMapMouseMove);
      map.off("mouseup", handleMapMouseUp);
    };
  }, [map, isDraggingPolygon]);

  // Handle saving visual coordinates
  const handleSaveVisualCoords = async () => {
    if (!editingLot || editingCoords.length < 3) return;

    setIsSavingCoords(true);
    try {
      await axios.put(`${API_BASE_URL}/api/lots/${editingLot.lot_id}/coordinates`, {
        coordinates: editingCoords,
      });

      alert("Coordinates updated successfully!");
      handleLotUpdated();
      setEditingLot(null);
    } catch (err) {
      console.error("Error saving coordinates:", err);
      alert(err.response?.data?.error || "Failed to update coordinates");
    } finally {
      setIsSavingCoords(false);
    }
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
            // to prevent Leaflet from resetting to world view on TileLayer remount
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
          triggerArrivalPulse={triggerArrivalPulse}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
        />
        <ActiveMapTileLayer activeLayer={mapLayer} />

        {/* ── Zoomed-Out Overview Green Property Location Beacons (< 17 zoom) ── */}
        {currentZoom < 17 &&
          properties.map((property) => {
            if (!property.coordinates || !Array.isArray(property.coordinates) || property.coordinates.length < 2) return null;
            // Hide green beacon for the currently selected property — it already has
            // the blue arrival pulse and/or the user is actively looking at it.
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
                  <!-- Outer Expanding Radar Pulse Wave 1 -->
                  <div style="position: absolute; width: 62px; height: 62px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.45); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <!-- Mid Sonar Pulse Wave 2 -->
                  <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.35); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 0.35s;"></div>
                  <!-- Solid Royal Blue Center Beacon with Location Pin Icon -->
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
        {/* ── Site Plan Image Overlay ───────────────────────────── */}
        {overlayImage && overlayBounds && overlayVisible && (
          <ImageOverlay
            ref={overlayRef}
            url={overlayImage}
            bounds={overlayBounds}
            opacity={overlayOpacity}
            zIndex={10}
          />
        )}

        {/* ── Overlay Corner Alignment Handles ─────────────────── */}
        {overlayImage && overlayBounds && isEditingOverlay && (
          <>
            {/* SW */}
            <Marker
              position={[overlayBounds[0][0], overlayBounds[0][1]]}
              draggable={true}
              icon={createOverlayCornerIcon("SW")}
              eventHandlers={{
                dragstart: () => handleOverlayCornerDragStart(overlayBounds),
                drag: (e) => handleOverlayCornerDrag("sw", e),
                dragend: handleOverlayCornerDragEnd,
              }}
            />
            {/* SE */}
            <Marker
              position={[overlayBounds[0][0], overlayBounds[1][1]]}
              draggable={true}
              icon={createOverlayCornerIcon("SE")}
              eventHandlers={{
                dragstart: () => handleOverlayCornerDragStart(overlayBounds),
                drag: (e) => handleOverlayCornerDrag("se", e),
                dragend: handleOverlayCornerDragEnd,
              }}
            />
            {/* NE */}
            <Marker
              position={[overlayBounds[1][0], overlayBounds[1][1]]}
              draggable={true}
              icon={createOverlayCornerIcon("NE")}
              eventHandlers={{
                dragstart: () => handleOverlayCornerDragStart(overlayBounds),
                drag: (e) => handleOverlayCornerDrag("ne", e),
                dragend: handleOverlayCornerDragEnd,
              }}
            />
            {/* NW */}
            <Marker
              position={[overlayBounds[1][0], overlayBounds[0][1]]}
              draggable={true}
              icon={createOverlayCornerIcon("NW")}
              eventHandlers={{
                dragstart: () => handleOverlayCornerDragStart(overlayBounds),
                drag: (e) => handleOverlayCornerDrag("nw", e),
                dragend: handleOverlayCornerDragEnd,
              }}
            />
          </>
        )}

        {/* ── Overlay Center Move Handle ─────────────────────────── */}
        {overlayImage &&
          overlayBounds &&
          isEditingOverlay &&
          (() => {
            const cLat = (overlayBounds[0][0] + overlayBounds[1][0]) / 2;
            const cLng = (overlayBounds[0][1] + overlayBounds[1][1]) / 2;
            return (
              <Marker
                position={[cLat, cLng]}
                draggable={true}
                icon={createOverlayCenterIcon()}
                eventHandlers={{
                  dragstart: (e) => {
                    console.log(
                      "Center drag start. Target LatLng:",
                      e.target.getLatLng(),
                      "Overlay bounds:",
                      overlayBounds
                    );
                    if (map) map.dragging.disable();
                    overlayMoveStartRef.current = {
                      startLat: e.target.getLatLng().lat,
                      startLng: e.target.getLatLng().lng,
                      initBounds: overlayBounds.map((c) => [...c]),
                    };
                  },
                  drag: (e) => {
                    if (!overlayMoveStartRef.current || !overlayRef.current) {
                      console.log("Center drag ignored. Start ref or overlay ref null:", {
                        start: !!overlayMoveStartRef.current,
                        overlay: !!overlayRef.current,
                      });
                      return;
                    }
                    const { lat, lng } = e.target.getLatLng();
                    const { startLat, startLng, initBounds } = overlayMoveStartRef.current;
                    const dLat = lat - startLat;
                    const dLng = lng - startLng;
                    const newBounds = [
                      [initBounds[0][0] + dLat, initBounds[0][1] + dLng],
                      [initBounds[1][0] + dLat, initBounds[1][1] + dLng],
                    ];
                    console.log("Center drag. Offset:", { dLat, dLng }, "New bounds:", newBounds);
                    // Update Leaflet layer directly — no React re-render during drag
                    overlayRef.current.setBounds(newBounds);
                  },
                  dragend: (e) => {
                    if (map) map.dragging.enable();
                    if (!overlayMoveStartRef.current) {
                      console.log("Center dragend ignored — start ref null");
                      return;
                    }
                    const { lat, lng } = e.target.getLatLng();
                    const { startLat, startLng, initBounds } = overlayMoveStartRef.current;
                    const dLat = lat - startLat;
                    const dLng = lng - startLng;
                    const finalBounds = [
                      [initBounds[0][0] + dLat, initBounds[0][1] + dLng],
                      [initBounds[1][0] + dLat, initBounds[1][1] + dLng],
                    ];
                    console.log("Center drag end. Setting final bounds state to:", finalBounds);
                    // Sync final position to React state once on drop
                    setOverlayBounds(finalBounds);
                    overlayMoveStartRef.current = null;
                  },
                }}
              />
            );
          })()}

        {/* ── Bulk Shift Controller Handle ────────────────────────── */}
        {isBulkShifting &&
          (() => {
            const center = map
              ? map.getCenter()
              : { lat: selectedPropertyCoords[0], lng: selectedPropertyCoords[1] };
            return (
              <Marker
                position={[center.lat, center.lng]}
                draggable={true}
                icon={createBulkShiftCenterIcon()}
                eventHandlers={{
                  dragstart: (e) => {
                    if (map) map.dragging.disable();
                    bulkShiftStartRef.current = {
                      startLat: e.target.getLatLng().lat,
                      startLng: e.target.getLatLng().lng,
                    };
                  },
                  drag: (e) => {
                    if (!bulkShiftStartRef.current) return;
                    const { lat, lng } = e.target.getLatLng();
                    const { startLat, startLng } = bulkShiftStartRef.current;
                    setBulkShiftOffset({
                      lat: lat - startLat,
                      lng: lng - startLng,
                    });
                  },
                  dragend: () => {
                    if (map) map.dragging.enable();
                  },
                }}
              />
            );
          })()}

        {filteredLots.map((lot) => {
          // Skip rendering original polygon if it's currently being edited visually
          if (editingLot && lot.lot_id === editingLot.lot_id) {
            return null;
          }

          // Skip lots with invalid or missing coordinates
          if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
            console.warn(
              `Lot ${lot.lot_id} (${lot.lot_number}) has invalid coordinates, skipping...`
            );
            return null;
          }

          // Apply bulk shift offset if active for this property's lots
          const coords =
            isBulkShifting && lot.property_id === selectedProperty
              ? lot.coordinates.map(([lat, lng]) => [
                  lat + bulkShiftOffset.lat,
                  lng + bulkShiftOffset.lng,
                ])
              : lot.coordinates;

          const centerLat = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
          const centerLng = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
          const pinLat = centerLat + 0.00012;
          const statusColor = getStatusColor(lot.status);

          const handleLotClick = async (e) => {
            if (editingLot) return;
            if (e?.originalEvent) {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
            }

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
                {
                  withCredentials: true,
                }
              );
              setSelectedLot({
                ...lotDetails.data,
                property_name: lotDetails.data.property_name || propName,
                location: lotDetails.data.location || propLocation,
              });
            } catch (err) {
              console.error("Lot Details Error:", err);
            }
          };

          return (
            <React.Fragment key={`lot-node-${lot.lot_id}-${lot.status}`}>
              <Polygon
                key={`poly-${lot.lot_id}-${lot.status}`}
                positions={coords}
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
                <Popup>
                  <div>
                    <strong>{lot.lot_number}</strong>
                    <br />
                    Area: {lot.area_sqm} SQM
                    <br />
                    Status: <strong style={{ color: statusColor }}>{lot.status}</strong>
                  </div>
                </Popup>
              </Polygon>

              {currentZoom >= 17 && (
                <>
                  <Polyline
                    key={`line-${lot.lot_id}-${centerLat}-${centerLng}`}
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
                    key={`pin-${lot.lot_id}-${lot.status}-${centerLat.toFixed(6)}-${centerLng.toFixed(6)}`}
                    position={[pinLat, centerLng]}
                    icon={createPinIcon(lot.status)}
                    eventHandlers={{
                      click: handleLotClick,
                    }}
                  >
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

        {/* Render Editable Polygon & Draggable Handles when editing coordinates */}
        {editingLot && (
          <>
            <Polygon
              ref={editingPolygonRef}
              positions={editingCoords}
              pathOptions={{
                color: "#10b981",
                fillColor: "#10b981",
                fillOpacity: 0.45,
                weight: 4,
                dashArray: "6, 6",
                className: isDraggingPolygon ? "cursor-grabbing" : "cursor-grab",
              }}
              eventHandlers={{
                mousedown: (e) => {
                  e.originalEvent.stopPropagation();
                  const startLatLng = e.latlng;
                  const initialCoords = editingCoords.map((c) => [...c]);
                  polygonDragRef.current = { startLatLng, initialCoords };
                  setIsDraggingPolygon(true);
                  if (map) {
                    map.dragging.disable();
                  }
                },
              }}
            />
            {editingCoords.map((coord, index) => (
              <Marker
                key={`handle-${index}`}
                ref={(el) => (cornerMarkersRef.current[index] = el)}
                position={coord}
                draggable={true}
                icon={createHandleIcon(index)}
                eventHandlers={{
                  dragstart: () => {
                    if (map) {
                      map.dragging.disable();
                    }
                    dragCoordsRef.current = editingCoords.map((c) => [...c]);
                  },
                  drag: (e) => handleVertexDrag(index, e),
                  dragend: (e) => {
                    if (map) {
                      map.dragging.enable();
                    }
                    handleVertexDragEnd(index, e);
                  },
                  dblclick: (e) => {
                    e.originalEvent.stopPropagation();
                    handleRemoveVertex(index);
                  },
                }}
              />
            ))}

            {/* Render interactive midpoints to easily add corners in specific locations */}
            {midpointHandles.map((mid, idx) => (
              <Marker
                key={`midpoint-${idx}-${editingCoords.length}`}
                position={mid.position}
                icon={createMidpointIcon()}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    handleAddVertexAtIndex(mid.insertIndex, mid.position);
                  },
                }}
              />
            ))}
          </>
        )}
      </MapContainer>

      {/* Floating Coordinate Editor Panel */}
      {editingLot && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl p-4 z-[999] flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 w-11/12 max-w-lg">
          <div className="flex-1">
            <span className="font-semibold text-gray-800 dark:text-white block text-sm">
              Editing Coordinates: Lot {editingLot.lot_number}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
              Drag corners (1, 2, 3...) to adjust. Double-click a corner to delete. Click "+" on any
              side to add a corner there.
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleSaveVisualCoords}
              disabled={isSavingCoords}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              {isSavingCoords ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditingLot(null)}
              className="px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Floating Bulk Shift Alignment Editor Panel */}
      {isBulkShifting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl p-4 z-[999] flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 w-11/12 max-w-lg">
          <div className="flex-1">
            <span className="font-semibold text-red-600 dark:text-red-400 block text-sm flex items-center gap-1.5">
              <span>⚡</span> Bulk Aligning Lots
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
              Drag the red crosshair handle in the center to slide all green lots into alignment.
              Click "Save" to apply.
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleSaveBulkShift}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              Save Shift
            </button>
            <button
              onClick={() => {
                setIsBulkShifting(false);
                setBulkShiftOffset({ lat: 0, lng: 0 });
              }}
              className="px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        isAdmin={true}
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
        onClose={() => setIsOffcanvasOpen(false)}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
        showCoordinateEdit={true}
        onStartCoordinateEdit={(lot) => {
          setIsOffcanvasOpen(false);
          window.dispatchEvent(
            new CustomEvent("startVisualEdit", {
              detail: {
                lot_id: lot.lot_id,
                lot_number: lot.lot_number,
                property_id: lot.property_id,
                coordinates: lot.coordinates,
              },
            })
          );
        }}
      />

      {/* ── Site Plan Overlay Control Panel ──────────────────────────── */}
      {showOverlayPanel && (
        <ImageOverlayControl
          overlayImage={overlayImage}
          overlayOpacity={overlayOpacity}
          overlayVisible={overlayVisible}
          isEditingOverlay={isEditingOverlay}
          overlayRotation={overlayRotation}
          isBulkShifting={isBulkShifting}
          onImageUpload={handleImageUpload}
          onOpacityChange={setOverlayOpacity}
          onRotationChange={(deg) => {
            setOverlayRotation(deg);
            applyRotation(deg); // instant DOM update — no React state lag
          }}
          onFitToView={handleFitToView}
          onToggleVisible={() => setOverlayVisible((prev) => !prev)}
          onToggleEdit={() => setIsEditingOverlay((prev) => !prev)}
          onToggleBulkShift={() => {
            setIsBulkShifting((prev) => !prev);
            setBulkShiftOffset({ lat: 0, lng: 0 });
          }}
          onRemove={() => {
            if (overlayImage) URL.revokeObjectURL(overlayImage);
            setOverlayImage(null);
            setOverlayBounds(null);
            setIsEditingOverlay(false);
            setOverlayRotation(0);
          }}
          onClose={() => setShowOverlayPanel(false)}
        />
      )}
    </div>
  );
}

export default AdminViewMap;
