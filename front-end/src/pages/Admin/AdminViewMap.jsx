import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

import {
  MapContainer,
  Polygon,
  Popup,
  useMap,
  Marker,
  Tooltip,
  ImageOverlay,
} from "react-leaflet";
import axios from "axios";
import L from "leaflet";
import LotOffcanvas from "../../components/admin/LotOffcanvas";
import { ImageOverlayControl } from "../../components/admin/ImageOverlayControl";
import { BlueprintCropModal } from "../../components/admin/BlueprintCropModal";
import { MapAnnotationControl } from "../../components/admin/MapAnnotationControl";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import { MapLayerControls, ActiveMapTileLayer, MAP_LAYERS } from "../../components/admin/MapLayerControls";
import { preloadAllProperties } from "../../utils/tilePreloader";
import {
  geocodeAddress,
  MUNICIPALITY_COORDINATES,
  DEFAULT_COORDINATES_MAP,
} from "../../utils/geocoding";
import {
  calculateGeodesicArea,
  autoIncrementLotNumber,
  findSnapVertex,
  offsetPolygonAdjacent,
} from "../../utils/geoUtils";
import { Magnet, Copy, Ruler, Plus, X, GripHorizontal } from "lucide-react";
import {
  saveBlueprintOverlay,
  loadBlueprintOverlay,
  removeBlueprintOverlay,
} from "../../utils/overlayStorage";

// Fix for default icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

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

// Component to handle map centering and event listening
function MapController({
  center,
  onLotUpdated,
  selectedProperty,
  setSelectedProperty,
  triggerArrivalPulse,
  setMap,
  setCurrentZoom,
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

    // Only update React state on zoomend to avoid re-renders during active animations
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
          const coords = p.coordinates || DEFAULT_COORDINATES_MAP[p.id];
          if (!coords || !Array.isArray(coords) || coords.length < 2) return;
          try {
            const dist = curCenter.distanceTo(L.latLng(coords[0], coords[1]));
            if (dist < minDistanceMeters) {
              minDistanceMeters = dist;
              closestProp = p;
            }
          } catch (e) {}
        });

        // If user is within 3km of this property and it is different from current selection
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
  const [activePopupLot, setActivePopupLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    return parseInt(localStorage.getItem("selectedProperty")) || 1;
  });

  // Clear active popup on property change
  useEffect(() => {
    setActivePopupLot(null);
  }, [selectedProperty]);

  const triggerArrivalPulse = useCallback((coords) => {
    // Pulse handled smoothly
  }, []);

  // States for visual coordinate editing
  const [editingLot, setEditingLot] = useState(null);
  const [editingCoords, setEditingCoords] = useState([]);
  const [isSavingCoords, setIsSavingCoords] = useState(false);

  // ── Snapping Magnet States ────────────────────────────────────────────────
  const [enableSnapping, setEnableSnapping] = useState(true);

  // State and Ref for dragging the entire polygon
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const polygonDragRef = React.useRef(null);
  const draggedCoordsRef = React.useRef(null); // stores coordinates temporarily during bulk polygon drag

  // Refs for smooth vertex dragging
  const editingPolygonRef = React.useRef(null);
  const dragCoordsRef = React.useRef([]);
  const cornerMarkersRef = React.useRef([]); // stores refs to Leaflet Marker instances for direct DOM positioning during drag

  // Live Real-Time Geodesic Area Calculations
  const liveAreaSqm = useMemo(() => {
    return calculateGeodesicArea(editingCoords);
  }, [editingCoords]);

  const targetAreaSqm = useMemo(() => {
    if (!editingLot) return 0;
    if (editingLot.area_sqm) return Number(editingLot.area_sqm);
    const found = mapData?.lots?.find((l) => Number(l.lot_id) === Number(editingLot.lot_id));
    return found ? Number(found.area_sqm) : 0;
  }, [editingLot, mapData]);

  // ── Image Overlay States ──────────────────────────────────────────────────
  const [overlayImage, setOverlayImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null); // [[sw_lat, sw_lng], [ne_lat, ne_lng]]
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [overlayRotation, setOverlayRotation] = useState(0); // degrees
  const [overlayMultiply, setOverlayMultiply] = useState(true); // Transparent white paper mode
  const [overlayLineColor, setOverlayLineColor] = useState("cyan"); // High-contrast CAD color (cyan/amber/lime/white/black)
  const [overlayLineBoldness, setOverlayLineBoldness] = useState("super_fine"); // super_fine (hairline), fine, normal, bold
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const originalUploadedImageRef = React.useRef(null);
  const rawOverlayRef = React.useRef(null);
  const transparentOverlayRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const overlayFrameRef = React.useRef(null);
  const overlayCornerMarkersRef = React.useRef({});
  const overlayMoveStartRef = React.useRef(null);
  const overlayCornerDragRef = React.useRef(null); // stores {initBounds, currentBounds} during corner drag
  const unrotatedSpanRef = React.useRef(null);

  // ── Road & Map Text Labels (Annotations) States ───────────────────────────
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const [isEditingAnnotations, setIsEditingAnnotations] = useState(true);
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isSavingAnnotations, setIsSavingAnnotations] = useState(false);

  // ── Draggable Floating Quick Add Lot States ────────────────────────────────
  const [showQuickAddLot, setShowQuickAddLot] = useState(false);
  const [quickLotNumber, setQuickLotNumber] = useState("");
  const [quickAreaSqm, setQuickAreaSqm] = useState(100);
  const [quickStatus, setQuickStatus] = useState("Available");
  const [isCreatingQuickLot, setIsCreatingQuickLot] = useState(false);
  const [floatingPos, setFloatingPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 160)) : 380,
    y: 110,
  }));
  const isDraggingFloatingRef = React.useRef(false);
  const dragOffsetRef = React.useRef({ x: 0, y: 0 });

  const getNextSuggestedLotNumber = useCallback(() => {
    if (!mapData?.lots || mapData.lots.length === 0) return "Lot 1";
    const propertyLots = mapData.lots.filter(
      (l) => Number(l.property_id) === Number(selectedProperty)
    );
    if (propertyLots.length === 0) return "Lot 1";

    let maxNum = 0;
    for (const lot of propertyLots) {
      const match = String(lot.lot_number).match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `Lot ${maxNum + 1}`;
  }, [mapData, selectedProperty]);

  const handleOpenQuickAdd = useCallback(() => {
    setQuickLotNumber(getNextSuggestedLotNumber());
    setQuickAreaSqm(100);
    setQuickStatus("Available");
    setFloatingPos({
      x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 160)) : 380,
      y: 110,
    });
    setShowQuickAddLot(true);
  }, [getNextSuggestedLotNumber]);

  // Listen for openQuickAddLot event from AdminHeader Manage Lots
  useEffect(() => {
    const handleOpenQuickAddEvent = () => handleOpenQuickAdd();
    window.addEventListener("openQuickAddLot", handleOpenQuickAddEvent);
    return () => window.removeEventListener("openQuickAddLot", handleOpenQuickAddEvent);
  }, [handleOpenQuickAdd]);

  // Sync annotations when selectedProperty or mapData changes
  useEffect(() => {
    if (selectedProperty && mapData?.properties) {
      const prop = mapData.properties.find(
        (p) => Number(p.property_id) === Number(selectedProperty)
      );
      if (prop && prop.annotations) {
        try {
          const parsed =
            typeof prop.annotations === "string"
              ? JSON.parse(prop.annotations)
              : prop.annotations;
          if (Array.isArray(parsed)) {
            setAnnotations(parsed);
            if (parsed.length > 0) setActiveAnnotationId(parsed[0].id);
          } else {
            setAnnotations([]);
          }
        } catch (e) {
          setAnnotations([]);
        }
      } else {
        setAnnotations([]);
      }
    }
  }, [selectedProperty, mapData]);

  // All annotations across all active properties so labels appear without clicking dropdown
  const allPropertiesAnnotations = useMemo(() => {
    if (!mapData?.properties) return [];
    const result = [];
    mapData.properties.forEach((p) => {
      if (showAnnotationPanel && Number(p.property_id) === Number(selectedProperty)) {
        result.push(
          ...annotations.map((a) => ({ ...a, property_id: p.property_id }))
        );
        return;
      }
      if (!p.annotations) return;
      try {
        const parsed =
          typeof p.annotations === "string" ? JSON.parse(p.annotations) : p.annotations;
        if (Array.isArray(parsed)) {
          result.push(
            ...parsed.map((a) => ({ ...a, property_id: p.property_id }))
          );
        }
      } catch (e) {}
    });
    return result;
  }, [mapData, showAnnotationPanel, selectedProperty, annotations]);

  // Listen for openAnnotationPanel event from AdminHeader
  useEffect(() => {
    const handleOpenAnnotationEvent = () => {
      setShowAnnotationPanel((prev) => !prev);
      setIsEditingAnnotations(true);
    };
    window.addEventListener("openAnnotationPanel", handleOpenAnnotationEvent);
    return () =>
      window.removeEventListener("openAnnotationPanel", handleOpenAnnotationEvent);
  }, []);

  const handleAddAnnotation = useCallback(() => {
    const center = map
      ? map.getCenter()
      : {
          lat: DEFAULT_COORDINATES_MAP[selectedProperty]?.[0] || 10.7372,
          lng: DEFAULT_COORDINATES_MAP[selectedProperty]?.[1] || 122.4998,
        };
    const newId = "label_" + Date.now();
    const newLabel = {
      id: newId,
      text: `ROAD LOT ${annotations.length + 1} (6.50 M. WIDE)`,
      lat: center.lat,
      lng: center.lng,
      rotation: 0,
      fontSize: 12,
      color: "#ffffff",
    };
    setAnnotations((prev) => [...prev, newLabel]);
    setActiveAnnotationId(newId);
    setIsEditingAnnotations(true);
    setShowAnnotationPanel(true);
  }, [map, annotations.length, selectedProperty]);

  const handleUpdateAnnotation = useCallback((id, updates) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const handleDeleteAnnotation = useCallback(
    (id) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (activeAnnotationId === id) {
        setActiveAnnotationId(null);
      }
    },
    [activeAnnotationId]
  );

  const createRoadLabelIcon = useCallback((item, isEditing, isSelected) => {
    // Scaling is handled by CSS variable --road-label-scale (set on map container)
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
          font-weight: 700;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: 0.8px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9);
          white-space: nowrap;
          user-select: none;
          pointer-events: auto;
          cursor: ${isEditing ? 'grab' : 'pointer'};
          padding: 2px 4px;
          border: ${isEditing && isSelected ? '1px dashed rgba(255,255,255,0.6)' : 'none'};
          border-radius: 4px;
          background: transparent;
        ">
          <span>${item.text || ''}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // Draggable Floating window drag handler
  const handleFloatingMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
    isDraggingFloatingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - floatingPos.x,
      y: e.clientY - floatingPos.y,
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingFloatingRef.current) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 320, moveEvent.clientX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 340, moveEvent.clientY - dragOffsetRef.current.y));
      setFloatingPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingFloatingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleCreateQuickLot = async (e) => {
    if (e) e.preventDefault();
    const lotNum = (quickLotNumber || getNextSuggestedLotNumber()).trim();
    const area = parseFloat(quickAreaSqm) || 100;
    if (!lotNum) return;

    setIsCreatingQuickLot(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/lots`,
        {
          property_id: parseInt(selectedProperty),
          lot_number: lotNum,
          area_sqm: area,
          status: quickStatus,
        },
        { withCredentials: true }
      );

      const newLot = response.data;
      const nextNum = autoIncrementLotNumber(lotNum);
      setQuickLotNumber(nextNum);
      await handleLotUpdated();

      // Automatically launch the interactive 4-corner polygon coordinate editor on the map!
      window.dispatchEvent(
        new CustomEvent("startVisualEdit", {
          detail: {
            lot_id: newLot.lot_id,
            lot_number: newLot.lot_number,
            property_id: newLot.property_id,
            area_sqm: area,
            coordinates: null, // centers a default square right at current map focus
          },
        })
      );
    } catch (err) {
      console.error("Error creating quick lot:", err);
      alert(err.response?.data?.error || err.message || "Failed to create lot");
    } finally {
      setIsCreatingQuickLot(false);
    }
  };

  // ── Bulk Shift States ──────────────────────────────────────────────────────
  const [isBulkShifting, setIsBulkShifting] = useState(false);
  const [bulkShiftOffset, setBulkShiftOffset] = useState({ lat: 0, lng: 0 });

  // Handle moving a vertex on drag (updates Leaflet instance directly for performance/smoothness)
  const handleVertexDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();

    // Check vertex magnetic snapping to adjacent lots
    let targetLat = lat;
    let targetLng = lng;
    if (enableSnapping && map && mapData?.lots) {
      const snapCoords = findSnapVertex(
        [lat, lng],
        mapData.lots,
        editingLot?.lot_id,
        map,
        14
      );
      if (snapCoords) {
        targetLat = snapCoords[0];
        targetLng = snapCoords[1];
      }
    }

    if (!dragCoordsRef.current || dragCoordsRef.current.length === 0) {
      dragCoordsRef.current = editingCoords.map((c) => [...c]);
    }

    if (dragCoordsRef.current.length > index) {
      dragCoordsRef.current[index] = [targetLat, targetLng];
      if (editingPolygonRef.current) {
        editingPolygonRef.current.setLatLngs(dragCoordsRef.current);
      }
    }
  };

  // Sync back to React state only when dragging finishes
  const handleVertexDragEnd = (index, event) => {
    let { lat, lng } = event.target.getLatLng();

    if (enableSnapping && map && mapData?.lots) {
      const snapCoords = findSnapVertex(
        [lat, lng],
        mapData.lots,
        editingLot?.lot_id,
        map,
        14
      );
      if (snapCoords) {
        lat = snapCoords[0];
        lng = snapCoords[1];
      }
    }

    event.target.setLatLng([lat, lng]);

    if (!dragCoordsRef.current || dragCoordsRef.current.length === 0) {
      dragCoordsRef.current = editingCoords.map((c) => [...c]);
    }
    dragCoordsRef.current[index] = [lat, lng];

    const updated = dragCoordsRef.current.map((c) => [...c]);
    setEditingCoords(updated);

    if (editingPolygonRef.current) {
      editingPolygonRef.current.setLatLngs(updated);
    }
  };

  // Remove a vertex by index (triggered by double-clicking a corner handle)
  const handleRemoveVertex = (index) => {
    if (editingCoords.length <= 3) {
      alert("A polygon must have at least 3 corners.");
      return;
    }
    const base = dragCoordsRef.current?.length === editingCoords.length ? dragCoordsRef.current : editingCoords;
    const newCoords = base.filter((_, idx) => idx !== index);
    dragCoordsRef.current = newCoords.map((c) => [...c]);
    setEditingCoords(newCoords);
    if (editingPolygonRef.current) {
      editingPolygonRef.current.setLatLngs(newCoords);
    }
  };

  // Add a new vertex at a specific index
  const handleAddVertexAtIndex = (insertIndex, position) => {
    const base = dragCoordsRef.current?.length === editingCoords.length ? dragCoordsRef.current : editingCoords;
    const newCoords = [...base];
    newCoords.splice(insertIndex, 0, position);
    dragCoordsRef.current = newCoords.map((c) => [...c]);
    setEditingCoords(newCoords);
    if (editingPolygonRef.current) {
      editingPolygonRef.current.setLatLngs(newCoords);
    }
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
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          user-select: none;
        ">
          <!-- Outer pulsing ring for visibility and generous touch/drag target -->
          <div style="
            position: absolute;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 2px dashed #10b981;
            background-color: rgba(16, 185, 129, 0.25);
            pointer-events: none;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
          "></div>
          
          <!-- Exact center point (vertex) -->
          <div style="
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #10b981;
            border: 2px solid #ffffff;
            box-shadow: 0 0 4px rgba(0,0,0,0.6);
            pointer-events: none;
            z-index: 2;
          "></div>
          
          <!-- Corner number label (offset to top-right) -->
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            background-color: #047857;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            min-width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1.5px solid #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            z-index: 3;
            pointer-events: none;
          ">
            ${index + 1}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
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

  // Helper: computes exact 4 GPS corners of the rotated blueprint image
  const getRotatedBlueprintCorners = (bounds, rotationDeg, unrotatedSpan) => {
    if (!bounds || bounds.length < 2) return null;
    const cLat = (bounds[0][0] + bounds[1][0]) / 2;
    const cLng = (bounds[0][1] + bounds[1][1]) / 2;

    let baseLatSpan = unrotatedSpan ? unrotatedSpan.latSpan : Math.abs(bounds[1][0] - bounds[0][0]);
    let baseLngSpan = unrotatedSpan ? unrotatedSpan.lngSpan : Math.abs(bounds[1][1] - bounds[0][1]);
    const halfLat = baseLatSpan / 2;
    const halfLng = baseLngSpan / 2;

    const rad = ((rotationDeg || 0) * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);

    const rotateOffset = (dLat, dLng) => {
      const rotLat = dLat * cos - dLng * sin;
      const rotLng = dLng * cos + dLat * sin;
      return [cLat + rotLat, cLng + rotLng];
    };

    return {
      nw: rotateOffset(halfLat, -halfLng),
      ne: rotateOffset(halfLat, halfLng),
      se: rotateOffset(-halfLat, halfLng),
      sw: rotateOffset(-halfLat, -halfLng),
    };
  };

  // ── Overlay Corner Alignment Handles Handlers (Pinned & Synchronized to White Box) ─────
  const handleOverlayCornerDragStart = useCallback(
    (corner, currentBounds) => {
      if (map) map.dragging.disable();
      const corners = getRotatedBlueprintCorners(currentBounds, overlayRotation, unrotatedSpanRef.current);
      if (!corners) return;

      const oppositeCorner =
        corner === "sw" ? "ne" : corner === "ne" ? "sw" : corner === "se" ? "nw" : "se";
      const anchorPos = corners[oppositeCorner];

      overlayCornerDragRef.current = {
        corner,
        oppositeCorner,
        anchorPos,
        initBounds: currentBounds.map((c) => [...c]),
      };
    },
    [map, overlayRotation]
  );

  const handleOverlayCornerDrag = useCallback(
    (corner, e) => {
      if (!overlayCornerDragRef.current || !overlayRef.current) return;
      const { lat, lng } = e.target.getLatLng();
      const { anchorPos } = overlayCornerDragRef.current;
      const [anchorLat, anchorLng] = anchorPos;

      const newCenterLat = (anchorLat + lat) / 2;
      const newCenterLng = (anchorLng + lng) / 2;

      const dLat = lat - newCenterLat;
      const dLng = lng - newCenterLng;

      const rad = (-overlayRotation * Math.PI) / 180;
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      const unrotLat = dLat * cos - dLng * sin;
      const unrotLng = dLng * cos + dLat * sin;

      const halfLat = Math.max(0.0001, Math.abs(unrotLat));
      const halfLng = Math.max(0.0001, Math.abs(unrotLng));
      const baseLatSpan = halfLat * 2;
      const baseLngSpan = halfLng * 2;

      unrotatedSpanRef.current = { latSpan: baseLatSpan, lngSpan: baseLngSpan };

      const absRad = (overlayRotation * Math.PI) / 180;
      const absSin = Math.abs(Math.sin(absRad));
      const absCos = Math.abs(Math.cos(absRad));
      const bboxLatSpan = baseLatSpan * absCos + baseLngSpan * absSin;
      const bboxLngSpan = baseLatSpan * absSin + baseLngSpan * absCos;

      const newBounds = [
        [newCenterLat - bboxLatSpan / 2, newCenterLng - bboxLngSpan / 2],
        [newCenterLat + bboxLatSpan / 2, newCenterLng + bboxLngSpan / 2],
      ];
      overlayCornerDragRef.current.currentBounds = newBounds;

      // 1. Update ImageOverlay in real-time directly on Leaflet
      if (overlayRef.current) {
        overlayRef.current.setBounds(newBounds);
      }

      // 2. Update the yellow dashed boundary box & other 3 corner handles in real-time!
      const liveCorners = getRotatedBlueprintCorners(newBounds, overlayRotation, { latSpan: baseLatSpan, lngSpan: baseLngSpan });
      if (liveCorners) {
        if (overlayFrameRef.current) {
          overlayFrameRef.current.setLatLngs([liveCorners.nw, liveCorners.ne, liveCorners.se, liveCorners.sw]);
        }
        ["nw", "ne", "se", "sw"].forEach((cKey) => {
          if (cKey !== corner && overlayCornerMarkersRef.current[cKey]) {
            overlayCornerMarkersRef.current[cKey].setLatLng(liveCorners[cKey]);
          }
        });
      }
    },
    [overlayRotation]
  );

  // Helper: converts Blob/URL to permanent base64 Data URL for persistent IndexedDB storage
  const toDataURL = (urlOrBlob) => {
    return new Promise((resolve) => {
      if (!urlOrBlob) return resolve(urlOrBlob);
      if (typeof urlOrBlob === "string" && urlOrBlob.startsWith("data:")) {
        return resolve(urlOrBlob);
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        try {
          resolve(c.toDataURL("image/png"));
        } catch (e) {
          resolve(urlOrBlob);
        }
      };
      img.onerror = () => resolve(urlOrBlob);
      img.src = urlOrBlob;
    });
  };

  // Helper: converts paper/transparent background into alpha transparency & CAD lines into chosen high-contrast color, rotated on Canvas
  const createTransparentPaperImage = (imageUrl, lineColor = "cyan", rotationDeg = 0, lineBoldness = "fine") => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const rad = ((rotationDeg || 0) * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));

        const w = img.width;
        const h = img.height;
        const newW = Math.max(10, Math.floor(w * cos + h * sin));
        const newH = Math.max(10, Math.floor(w * sin + h * cos));

        canvas.width = newW;
        canvas.height = newH;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w / 2, -h / 2);

        try {
          const imgData = ctx.getImageData(0, 0, newW, newH);
          const data = imgData.data;

          // Color selection
          let targetR = 0, targetG = 240, targetB = 255; // Cyan default
          if (lineColor === "amber" || lineColor === "gold" || lineColor === "yellow") {
            targetR = 251; targetG = 191; targetB = 36;
          } else if (lineColor === "lime" || lineColor === "green") {
            targetR = 52; targetG = 211; targetB = 153;
          } else if (lineColor === "white") {
            targetR = 255; targetG = 255; targetB = 255;
          } else if (lineColor === "black") {
            targetR = 15; targetG = 23; targetB = 42;
          }

          const isDarkInk = lineColor === "black";

          // Smooth paper cutoff and curve exponent
          let paperThreshold = 225;
          let exponent = 2.0;
          if (lineBoldness === "super_fine") {
            paperThreshold = 210;
            exponent = 2.4;
          } else if (lineBoldness === "fine") {
            paperThreshold = 225;
            exponent = 1.7;
          } else if (lineBoldness === "normal") {
            paperThreshold = 235;
            exponent = 1.2;
          } else {
            paperThreshold = 245;
            exponent = 0.8;
          }

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 20) {
              data[i + 3] = 0;
              continue;
            }

            const lum = (r + g + b) / 3;

            if (lum >= paperThreshold) {
              data[i + 3] = 0; // 100% transparent background
            } else if (!isDarkInk) {
              const norm = (paperThreshold - lum) / paperThreshold; // 0 to 1
              // Cubic Hermite smoothstep for anti-aliasing without blur or stair-steps
              const smoothStep = norm * norm * (3 - 2 * norm);
              const alpha = Math.min(255, Math.max(0, Math.pow(smoothStep, exponent) * 255));

              data[i] = targetR;
              data[i + 1] = targetG;
              data[i + 2] = targetB;
              data[i + 3] = Math.round(alpha);
            }
          }

          // Dilation / Stroke Thickening Pass: only active when user explicitly chooses "bold"
          if (!isDarkInk && lineBoldness === "bold") {
            const copy = new Uint8ClampedArray(data);
            for (let y = 1; y < newH - 1; y++) {
              for (let x = 1; x < newW - 1; x++) {
                const idx = (y * newW + x) * 4;
                if (copy[idx + 3] < 50) {
                  const topA = copy[((y - 1) * newW + x) * 4 + 3];
                  const btmA = copy[((y + 1) * newW + x) * 4 + 3];
                  const lftA = copy[(y * newW + (x - 1)) * 4 + 3];
                  const rgtA = copy[(y * newW + (x + 1)) * 4 + 3];
                  if (topA > 200 || btmA > 200 || lftA > 200 || rgtA > 200) {
                    data[idx] = targetR;
                    data[idx + 1] = targetG;
                    data[idx + 2] = targetB;
                    data[idx + 3] = 200;
                  }
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
        } catch (e) {}

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(imageUrl);
          }
        }, "image/png");
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  };

  // ── Load Persistent Blueprint Overlay from IndexedDB on Mount or Property Switch ───
  useEffect(() => {
    let isCancelled = false;
    const fetchSavedOverlay = async () => {
      if (!selectedProperty) return;
      try {
        const data = await loadBlueprintOverlay(selectedProperty);
        if (isCancelled) return;

        if (data && data.rawImage && data.bounds) {
          rawOverlayRef.current = data.rawImage;
          originalUploadedImageRef.current = data.originalImage || data.rawImage;
          unrotatedSpanRef.current = data.unrotatedSpan || null;
          setOverlayRotation(data.rotation || 0);
          setOverlayOpacity(data.opacity ?? 1);
          const lineColor = data.lineColor || "cyan";
          const lineBoldness = data.lineBoldness || "super_fine";
          setOverlayLineColor(lineColor);
          setOverlayLineBoldness(lineBoldness);
          setOverlayMultiply(data.multiply ?? true);
          setOverlayBounds(data.bounds);

          const transUrl = await createTransparentPaperImage(data.rawImage, lineColor, data.rotation || 0, lineBoldness);
          if (isCancelled) return;
          transparentOverlayRef.current = transUrl;
          setOverlayImage(transUrl);
          setOverlayVisible(true);
        }
      } catch (err) {
        console.error("Error loading saved blueprint overlay:", err);
      }
    };

    fetchSavedOverlay();
    return () => {
      isCancelled = true;
    };
  }, [selectedProperty]);

  const handleOverlayCornerDragEnd = useCallback(() => {
    if (map) map.dragging.enable();
    if (overlayCornerDragRef.current && overlayCornerDragRef.current.currentBounds) {
      const finalBounds = overlayCornerDragRef.current.currentBounds;
      setOverlayBounds(finalBounds);
      overlayCornerDragRef.current = null;

      if (selectedProperty && rawOverlayRef.current) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: rawOverlayRef.current,
          originalImage: originalUploadedImageRef.current || rawOverlayRef.current,
          bounds: finalBounds,
          rotation: overlayRotation,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: unrotatedSpanRef.current,
        });
      }
    }
  }, [map, selectedProperty, overlayRotation, overlayOpacity, overlayLineColor, overlayMultiply]);

  // Handle Rotation with Canvas rendering — centered and 100% synchronized with map coordinates
  const handleRotationChange = useCallback(
    async (deg) => {
      setOverlayRotation(deg);
      const baseImg = rawOverlayRef.current || originalUploadedImageRef.current;
      if (!baseImg) return;

      const transUrl = await createTransparentPaperImage(baseImg, overlayLineColor, deg, overlayLineBoldness);
      if (transparentOverlayRef.current && transparentOverlayRef.current !== transUrl) {
        try { URL.revokeObjectURL(transparentOverlayRef.current); } catch (e) {}
      }
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);

      let finalBounds = null;
      setOverlayBounds((prev) => {
        if (!prev) return prev;
        const cLat = (prev[0][0] + prev[1][0]) / 2;
        const cLng = (prev[0][1] + prev[1][1]) / 2;

        const rad = ((deg || 0) * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));

        const baseLatSpan = unrotatedSpanRef.current ? unrotatedSpanRef.current.latSpan : Math.abs(prev[1][0] - prev[0][0]);
        const baseLngSpan = unrotatedSpanRef.current ? unrotatedSpanRef.current.lngSpan : Math.abs(prev[1][1] - prev[0][1]);

        if (!unrotatedSpanRef.current) {
          unrotatedSpanRef.current = { latSpan: baseLatSpan, lngSpan: baseLngSpan };
        }

        const newLatSpan = baseLatSpan * cos + baseLngSpan * sin;
        const newLngSpan = baseLatSpan * sin + baseLngSpan * cos;

        const newBounds = [
          [cLat - newLatSpan / 2, cLng - newLngSpan / 2],
          [cLat + newLatSpan / 2, cLng + newLngSpan / 2],
        ];
        if (overlayRef.current) overlayRef.current.setBounds(newBounds);
        finalBounds = newBounds;
        return newBounds;
      });

      if (selectedProperty && baseImg) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: baseImg,
          originalImage: originalUploadedImageRef.current || baseImg,
          bounds: finalBounds || overlayBounds,
          rotation: deg,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          lineBoldness: overlayLineBoldness,
          multiply: overlayMultiply,
          unrotatedSpan: unrotatedSpanRef.current,
        });
      }
    },
    [overlayLineColor, overlayLineBoldness, selectedProperty, overlayBounds, overlayOpacity, overlayMultiply]
  );

  // Switch CAD Line Color (Cyan, Amber, Lime, White, Black)
  const handleLineColorChange = useCallback(
    async (color) => {
      setOverlayLineColor(color);
      const src = rawOverlayRef.current;
      if (!src) return;
      const transUrl = await createTransparentPaperImage(src, color, overlayRotation, overlayLineBoldness);
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);

      if (selectedProperty && overlayBounds) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: src,
          originalImage: originalUploadedImageRef.current || src,
          bounds: overlayBounds,
          rotation: overlayRotation,
          opacity: overlayOpacity,
          lineColor: color,
          lineBoldness: overlayLineBoldness,
          multiply: overlayMultiply,
          unrotatedSpan: unrotatedSpanRef.current,
        });
      }
    },
    [overlayRotation, overlayLineBoldness, selectedProperty, overlayBounds, overlayOpacity, overlayMultiply]
  );

  // Switch CAD Line Boldness / Thickness (Fine, Normal, Bold)
  const handleLineBoldnessChange = useCallback(
    async (boldness) => {
      setOverlayLineBoldness(boldness);
      const src = rawOverlayRef.current;
      if (!src) return;
      const transUrl = await createTransparentPaperImage(src, overlayLineColor, overlayRotation, boldness);
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);

      if (selectedProperty && overlayBounds) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: src,
          originalImage: originalUploadedImageRef.current || src,
          bounds: overlayBounds,
          rotation: overlayRotation,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          lineBoldness: boldness,
          multiply: overlayMultiply,
          unrotatedSpan: unrotatedSpanRef.current,
        });
      }
    },
    [overlayLineColor, overlayRotation, selectedProperty, overlayBounds, overlayOpacity, overlayMultiply]
  );

  // Crop overlay on canvas to keep only the subdivision lots
  const handleApplyCrop = useCallback(
    async (croppedUrl, cropBounds) => {
      const dataUrl = await toDataURL(croppedUrl);
      rawOverlayRef.current = dataUrl;
      setOverlayRotation(0);
      const transUrl = await createTransparentPaperImage(dataUrl, overlayLineColor, 0);
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);

      let finalBounds = overlayBounds;
      let finalSpan = unrotatedSpanRef.current;

      if (overlayBounds) {
        const origLatSpan = Math.abs(overlayBounds[1][0] - overlayBounds[0][0]);
        const origLngSpan = Math.abs(overlayBounds[1][1] - overlayBounds[0][1]);
        const cLat = (overlayBounds[0][0] + overlayBounds[1][0]) / 2;
        const cLng = (overlayBounds[0][1] + overlayBounds[1][1]) / 2;

        if (cropBounds && cropBounds.width && cropBounds.height) {
          const newLatSpan = origLatSpan * (cropBounds.height / 100);
          const newLngSpan = origLngSpan * (cropBounds.width / 100);

          const cropCenterXRatio = (cropBounds.minX + cropBounds.maxX) / 200;
          const cropCenterYRatio = (cropBounds.minY + cropBounds.maxY) / 200;

          const lngOffset = (cropCenterXRatio - 0.5) * origLngSpan;
          const latOffset = (0.5 - cropCenterYRatio) * origLatSpan;

          const newCenterLat = cLat + latOffset;
          const newCenterLng = cLng + lngOffset;

          finalBounds = [
            [newCenterLat - newLatSpan / 2, newCenterLng - newLngSpan / 2],
            [newCenterLat + newLatSpan / 2, newCenterLng + newLngSpan / 2],
          ];
          finalSpan = { latSpan: newLatSpan, lngSpan: newLngSpan };
          unrotatedSpanRef.current = finalSpan;
          if (overlayRef.current) overlayRef.current.setBounds(finalBounds);
          setOverlayBounds(finalBounds);
        }
      }

      if (selectedProperty && finalBounds) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: dataUrl,
          originalImage: originalUploadedImageRef.current || dataUrl,
          bounds: finalBounds,
          rotation: 0,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: finalSpan,
        });
      }
    },
    [overlayBounds, overlayLineColor, selectedProperty, overlayOpacity, overlayMultiply]
  );

  // Reset overlay rotation back to 0° (preserving the cropped blueprint image and scale)
  const handleResetOverlay = useCallback(async () => {
    handleRotationChange(0);
  }, [handleRotationChange]);

  // Handle image upload — place overlay centered on current map view
  const handleImageUpload = useCallback(
    async (imageUrl) => {
      const dataUrl = await toDataURL(imageUrl);
      if (rawOverlayRef.current && rawOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(rawOverlayRef.current);
      }
      if (transparentOverlayRef.current && transparentOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(transparentOverlayRef.current);
      }

      originalUploadedImageRef.current = dataUrl;
      rawOverlayRef.current = dataUrl;
      setOverlayRotation(0);

      const transUrl = await createTransparentPaperImage(dataUrl, overlayLineColor, 0);
      transparentOverlayRef.current = transUrl;

      setOverlayImage(transUrl);
      setOverlayVisible(true);
      setIsEditingOverlay(true);

      let initBounds = null;
      let initSpan = null;
      if (map) {
        const bounds = map.getBounds();
        const latSpan = (bounds.getNorth() - bounds.getSouth()) * 0.7;
        const lngSpan = (bounds.getEast() - bounds.getWest()) * 0.7;
        const center = map.getCenter();
        initBounds = [
          [center.lat - latSpan / 2, center.lng - lngSpan / 2],
          [center.lat + latSpan / 2, center.lng + lngSpan / 2],
        ];
        initSpan = { latSpan, lngSpan };
        unrotatedSpanRef.current = initSpan;
        setOverlayBounds(initBounds);
      }

      if (selectedProperty && initBounds) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: dataUrl,
          originalImage: dataUrl,
          bounds: initBounds,
          rotation: 0,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: initSpan,
        });
      }
    },
    [map, overlayLineColor, selectedProperty, overlayOpacity, overlayMultiply]
  );

  // Scale overlay size proportionally (keeping exact aspect ratio)
  const handleScaleOverlay = useCallback((factor) => {
    setOverlayBounds((prev) => {
      if (!prev) return prev;
      const cLat = (prev[0][0] + prev[1][0]) / 2;
      const cLng = (prev[0][1] + prev[1][1]) / 2;
      const halfLat = ((prev[1][0] - prev[0][0]) / 2) * factor;
      const halfLng = ((prev[1][1] - prev[0][1]) / 2) * factor;
      const newBounds = [
        [cLat - halfLat, cLng - halfLng],
        [cLat + halfLat, cLng + halfLng],
      ];
      if (overlayRef.current) overlayRef.current.setBounds(newBounds);

      if (selectedProperty && rawOverlayRef.current) {
        saveBlueprintOverlay(selectedProperty, {
          rawImage: rawOverlayRef.current,
          originalImage: originalUploadedImageRef.current || rawOverlayRef.current,
          bounds: newBounds,
          rotation: overlayRotation,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: unrotatedSpanRef.current,
        });
      }

      return newBounds;
    });
  }, [selectedProperty, overlayRotation, overlayOpacity, overlayLineColor, overlayMultiply]);

  // Save bulk shifted coordinates to database
  const handleSaveBulkShift = async () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setIsBulkShifting(false);
      return;
    }

    if (!window.confirm(`Are you sure you want to save the new position for all lots in this property?`)) {
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/api/lots/property/${selectedProperty}/bulk-shift`, {
        deltaLat: bulkShiftOffset.lat,
        deltaLng: bulkShiftOffset.lng,
      });

      alert("✅ All lots have been moved and saved successfully!");
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
  // Only show ACTIVE properties on the map
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties.filter((p) => p.status !== "inactive").map((p) => {
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

    return properties.length > 0 ? [10.7372, 122.4998] : [10.90, 122.60];
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
  const handleLotUpdated = useCallback(async () => {
    try {
      const mapResponse = await axios.get(`${API_BASE_URL}/api/lots/map-data`, {
        withCredentials: true,
      });

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
              return lot;
            }
          }
          return lot;
        })
      );

      const finalMapData = { ...mapResponse.data, lots: lotsWithCustomerData };
      setMapData(finalMapData);
      try {
        sessionStorage.setItem("mapDataCache", JSON.stringify(finalMapData));
      } catch (e) {}
      return finalMapData;
    } catch (err) {
      console.error("Map Refresh Error:", err);
      return null;
    }
  }, []);

  const handleSaveAnnotations = useCallback(async () => {
    if (!selectedProperty) return;
    setIsSavingAnnotations(true);
    try {
      await axios.put(
        `${API_BASE_URL}/api/properties/${selectedProperty}/annotations`,
        { annotations },
        { withCredentials: true }
      );
      alert("✅ Road & map labels saved successfully to database!");
      await handleLotUpdated();
    } catch (err) {
      console.error("Error saving map annotations:", err);
      alert(err.response?.data?.error || "Failed to save road labels");
    } finally {
      setIsSavingAnnotations(false);
    }
  }, [selectedProperty, annotations, handleLotUpdated]);

  // Listen for coordinate updates from AdminHeader
  useEffect(() => {
    const handleRefreshMapData = () => {
      handleLotUpdated();
    };

    window.addEventListener("refreshMapData", handleRefreshMapData);

    return () => {
      window.removeEventListener("refreshMapData", handleRefreshMapData);
    };
  }, [handleLotUpdated]);

  // Listen for openOverlayPanel event from AdminHeader
  useEffect(() => {
    const handleOpenOverlay = () => setShowOverlayPanel(true);
    window.addEventListener("openOverlayPanel", handleOpenOverlay);
    return () => window.removeEventListener("openOverlayPanel", handleOpenOverlay);
  }, []);

  // Listen for toggleBulkShiftLots event from AdminHeader
  useEffect(() => {
    const handleToggleBulkShift = () => {
      setIsBulkShifting((prev) => !prev);
      setBulkShiftOffset({ lat: 0, lng: 0 });
    };
    window.addEventListener("toggleBulkShiftLots", handleToggleBulkShift);
    return () => window.removeEventListener("toggleBulkShiftLots", handleToggleBulkShift);
  }, []);

  // Listen for start visual edit event
  useEffect(() => {
    const handleStartVisualEdit = (event) => {
      const { lot_id, lot_number, property_id, coordinates, area_sqm } = event.detail;
      setEditingLot({ lot_id, lot_number, property_id, area_sqm });

      let initCoords = [];
      if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
        initCoords = coordinates.map((c) => [...c]);
      } else {
        // Use current active map center if available so coordinates appear exactly where user is focused
        const currentCenter = map ? map.getCenter() : null;
        const baseCoords =
          currentCenter
            ? [currentCenter.lat, currentCenter.lng]
            : properties.find((p) => Number(p.id) === Number(property_id))?.coordinates ||
              selectedPropertyCoords;

        const targetArea = parseFloat(area_sqm) || 100;
        const sideMeters = Math.sqrt(targetArea); // ~10m for 100 sqm
        const latRad = (baseCoords[0] * Math.PI) / 180;
        const dLat = (sideMeters / 2) / 111320;
        const dLng = (sideMeters / 2) / (111320 * Math.cos(latRad));

        // Rotate initial square according to blueprint rotation angle
        const rotRad = ((overlayRotation || 0) * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const corners = [
          [-dLat, -dLng],
          [dLat, -dLng],
          [dLat, dLng],
          [-dLat, dLng],
        ];

        initCoords = corners.map(([dy, dx]) => {
          const rotY = dy * cosR - dx * sinR;
          const rotX = dy * sinR + dx * cosR;
          return [baseCoords[0] + rotY, baseCoords[1] + rotX];
        });
      }

      dragCoordsRef.current = initCoords.map((c) => [...c]);
      setEditingCoords(initCoords);
    };

    window.addEventListener("startVisualEdit", handleStartVisualEdit);
    return () => {
      window.removeEventListener("startVisualEdit", handleStartVisualEdit);
    };
  }, [map, properties, selectedPropertyCoords, overlayRotation]);

  // Handle dragging the entire polygon shape with global pointer tracking & magnetic snapping
  useEffect(() => {
    if (!map) return;

    const handleGlobalMouseMove = (e) => {
      if (!isDraggingPolygon || !polygonDragRef.current || !map) return;

      const { startLatLng, initialCoords } = polygonDragRef.current;
      let mouseLatLng = e.latlng;
      if (!mouseLatLng && typeof e.clientX === "number" && typeof e.clientY === "number") {
        try {
          mouseLatLng = map.mouseEventToLatLng(e);
        } catch (err) {
          return;
        }
      }
      if (!mouseLatLng) return;

      let deltaLat = mouseLatLng.lat - startLatLng.lat;
      let deltaLng = mouseLatLng.lng - startLatLng.lng;

      let candidateCoords = initialCoords.map(([lat, lng]) => [
        lat + deltaLat,
        lng + deltaLng,
      ]);

      // Magnetic snapping for the entire polygon: snap any corner to adjacent lot vertices
      if (enableSnapping && mapData?.lots) {
        for (let i = 0; i < candidateCoords.length; i++) {
          const corner = candidateCoords[i];
          const snapTarget = findSnapVertex(
            corner,
            mapData.lots,
            editingLot?.lot_id,
            map,
            16
          );
          if (snapTarget) {
            const snapDeltaLat = snapTarget[0] - corner[0];
            const snapDeltaLng = snapTarget[1] - corner[1];
            candidateCoords = candidateCoords.map(([lat, lng]) => [
              lat + snapDeltaLat,
              lng + snapDeltaLng,
            ]);
            break;
          }
        }
      }

      // Direct Leaflet element updates for buttery smooth 60 FPS movement
      if (editingPolygonRef.current) {
        editingPolygonRef.current.setLatLngs(candidateCoords);
      }

      // Synchronously move all corner markers with the polygon
      if (cornerMarkersRef.current) {
        cornerMarkersRef.current.forEach((marker, index) => {
          if (marker && candidateCoords[index]) {
            marker.setLatLng(candidateCoords[index]);
          }
        });
      }

      dragCoordsRef.current = candidateCoords.map((c) => [...c]);
      draggedCoordsRef.current = candidateCoords;
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingPolygon) {
        setIsDraggingPolygon(false);
        polygonDragRef.current = null;
        if (map) {
          map.dragging.enable();
        }

        if (draggedCoordsRef.current) {
          const finalCoords = draggedCoordsRef.current.map((c) => [...c]);
          dragCoordsRef.current = finalCoords.map((c) => [...c]);
          setEditingCoords(finalCoords);
          draggedCoordsRef.current = null;
        }
      }
    };

    if (isDraggingPolygon) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      map.on("mousemove", handleGlobalMouseMove);
      map.on("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      map.off("mousemove", handleGlobalMouseMove);
      map.off("mouseup", handleGlobalMouseUp);
    };
  }, [map, isDraggingPolygon, enableSnapping, mapData, editingLot]);

  // Handle scaling the current editing polygon around its center
  const handleScaleEditingCoords = (factor) => {
    if (!editingCoords || editingCoords.length === 0) return;
    let sumLat = 0;
    let sumLng = 0;
    editingCoords.forEach(([lat, lng]) => {
      sumLat += lat;
      sumLng += lng;
    });
    const cLat = sumLat / editingCoords.length;
    const cLng = sumLng / editingCoords.length;

    const scaled = editingCoords.map(([lat, lng]) => [
      cLat + (lat - cLat) * factor,
      cLng + (lng - cLng) * factor,
    ]);

    setEditingCoords(scaled);
    dragCoordsRef.current = scaled.map((c) => [...c]);
  };

  // Handle resetting the polygon to an exact standard lot square (e.g. 100 sqm)
  const handleResetToSquareSize = (targetArea = 100) => {
    if (!editingCoords || editingCoords.length === 0) return;
    let sumLat = 0;
    let sumLng = 0;
    editingCoords.forEach(([lat, lng]) => {
      sumLat += lat;
      sumLng += lng;
    });
    const cLat = sumLat / editingCoords.length;
    const cLng = sumLng / editingCoords.length;

    const sideMeters = Math.sqrt(targetArea);
    const latRad = (cLat * Math.PI) / 180;
    const dLat = (sideMeters / 2) / 111320;
    const dLng = (sideMeters / 2) / (111320 * Math.cos(latRad));

    const rotRad = ((overlayRotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const corners = [
      [-dLat, -dLng],
      [dLat, -dLng],
      [dLat, dLng],
      [-dLat, dLng],
    ];

    const newCoords = corners.map(([dy, dx]) => {
      const rotY = dy * cosR - dx * sinR;
      const rotX = dy * sinR + dx * cosR;
      return [cLat + rotY, cLng + rotX];
    });

    setEditingCoords(newCoords);
    dragCoordsRef.current = newCoords.map((c) => [...c]);
  };

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

  // Handle saving visual coordinates and immediately auto-creating the adjacent next lot!
  const handleSaveAndAddNext = async () => {
    if (!editingLot || editingCoords.length < 3) return;
    setIsSavingCoords(true);
    try {
      await axios.put(`${API_BASE_URL}/api/lots/${editingLot.lot_id}/coordinates`, {
        coordinates: editingCoords,
      });
      await handleLotUpdated();
      // Immediately duplicate & place adjacent next lot
      await handleDuplicateLot();
    } catch (err) {
      console.error("Error saving coordinates:", err);
      alert(err.response?.data?.error || "Failed to update coordinates");
    } finally {
      setIsSavingCoords(false);
    }
  };

  // Handle duplicating / cloning a lot with auto-incremented identifier & adjacent offset
  const handleDuplicateLot = async (lotToDuplicate) => {
    const sourceLot =
      lotToDuplicate ||
      (editingLot
        ? {
            lot_id: editingLot.lot_id,
            lot_number: editingLot.lot_number,
            property_id: editingLot.property_id,
            area_sqm: targetAreaSqm || editingLot.area_sqm || 100,
            coordinates: editingCoords.length >= 3 ? editingCoords : null,
          }
        : selectedLot);

    if (!sourceLot) {
      alert("Please select a lot to duplicate.");
      return;
    }

    const propId = sourceLot.property_id || selectedProperty;
    const nextLotNumber = autoIncrementLotNumber(sourceLot.lot_number || "Lot 1");
    const targetArea = sourceLot.area_sqm || 100;

    const confirmedName = window.prompt(
      `Duplicate Lot: Enter identifier for the new adjacent lot:`,
      nextLotNumber
    );

    // If user clicked cancel
    if (confirmedName === null) return;
    const finalLotName = (confirmedName || nextLotNumber).trim() || nextLotNumber;

    try {
      // 1. Resolve source lot polygon coordinates
      let rawCoords = null;
      if (editingCoords && Array.isArray(editingCoords) && editingCoords.length >= 3) {
        rawCoords = editingCoords;
      } else if (sourceLot.coordinates) {
        if (typeof sourceLot.coordinates === "string") {
          try {
            rawCoords = JSON.parse(sourceLot.coordinates);
          } catch (e) {}
        } else if (Array.isArray(sourceLot.coordinates)) {
          rawCoords = sourceLot.coordinates;
        }
      }

      if (!rawCoords || rawCoords.length < 3) {
        const foundInMap = mapData?.lots?.find(
          (l) => Number(l.lot_id) === Number(sourceLot.lot_id)
        );
        if (foundInMap && foundInMap.coordinates) {
          rawCoords =
            typeof foundInMap.coordinates === "string"
              ? JSON.parse(foundInMap.coordinates)
              : foundInMap.coordinates;
        }
      }

      if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length < 3) {
        const currentCenter = map ? map.getCenter() : null;
        const baseCoords = currentCenter ? [currentCenter.lat, currentCenter.lng] : selectedPropertyCoords;
        const offset = 0.00015;
        rawCoords = [
          [baseCoords[0] - offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] + offset],
          [baseCoords[0] - offset, baseCoords[1] + offset],
        ];
      }

      // 2. Generate adjacent offset coordinates
      const newCoords = offsetPolygonAdjacent(rawCoords);

      // 3. Create new lot record in backend database
      const createRes = await axios.post(
        `${API_BASE_URL}/api/lots`,
        {
          property_id: parseInt(propId),
          lot_number: finalLotName,
          area_sqm: parseFloat(targetArea) || 100,
          status: "Available",
        },
        { withCredentials: true }
      );

      const newLotId = createRes.data.lot_id;

      // 4. Save adjacent offset coordinates for the new lot
      if (newCoords && Array.isArray(newCoords) && newCoords.length >= 3) {
        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: newCoords },
          { withCredentials: true }
        );
      }

      // 5. Invalidate caches and refresh map data
      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      await handleLotUpdated();

      // 6. Close drawer and switch visual coordinate editor to the new lot
      setIsOffcanvasOpen(false);
      setEditingLot({
        lot_id: newLotId,
        lot_number: finalLotName,
        property_id: parseInt(propId),
        area_sqm: parseFloat(targetArea) || 100,
      });
      setEditingCoords(newCoords.map((c) => [...c]));

      window.dispatchEvent(
        new CustomEvent("startVisualEdit", {
          detail: {
            lot_id: newLotId,
            lot_number: finalLotName,
            property_id: parseInt(propId),
            area_sqm: parseFloat(targetArea) || 100,
            coordinates: newCoords,
          },
        })
      );

      alert(`✅ Successfully created ${finalLotName}! You can now adjust its corners.`);
    } catch (err) {
      console.error("Error duplicating lot:", err);
      alert(err.response?.data?.error || err.message || "Failed to duplicate lot");
    }
  };

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div
      ref={mapWrapperRef}
      className={`w-full h-full relative ${currentZoom < 18 ? "map-view-zoomed-out" : "map-view-zoomed-in"} ${showAnnotationPanel && isEditingAnnotations ? "map-editing-labels-active" : ""}`}
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
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
          triggerArrivalPulse={triggerArrivalPulse}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
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

                  axios.get(`${API_BASE_URL}/api/lots/${activePopupLot.lot_id}`)
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

        {/* ── Overlay Blueprint Frame / Boundary Guide (Connected to Rotated White Box) ──────────── */}
        {overlayImage && overlayBounds && isEditingOverlay && (() => {
          const corners = getRotatedBlueprintCorners(overlayBounds, overlayRotation, unrotatedSpanRef.current);
          if (!corners) return null;
          return (
            <>
              {/* Outer Glowing Yellow Dashed Line Connected to 4 Corners of White Box */}
              <Polygon
                ref={overlayFrameRef}
                positions={[corners.nw, corners.ne, corners.se, corners.sw]}
                pathOptions={{
                  color: "#f59e0b",
                  weight: 2.5,
                  dashArray: "6, 6",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.04,
                  interactive: false,
                }}
              />

              {/* SW */}
              <Marker
                ref={(el) => { if (el) overlayCornerMarkersRef.current["sw"] = el; }}
                position={corners.sw}
                draggable={true}
                icon={createOverlayCornerIcon("SW")}
                eventHandlers={{
                  dragstart: () => handleOverlayCornerDragStart("sw", overlayBounds),
                  drag: (e) => handleOverlayCornerDrag("sw", e),
                  dragend: handleOverlayCornerDragEnd,
                }}
              />
              {/* SE */}
              <Marker
                ref={(el) => { if (el) overlayCornerMarkersRef.current["se"] = el; }}
                position={corners.se}
                draggable={true}
                icon={createOverlayCornerIcon("SE")}
                eventHandlers={{
                  dragstart: () => handleOverlayCornerDragStart("se", overlayBounds),
                  drag: (e) => handleOverlayCornerDrag("se", e),
                  dragend: handleOverlayCornerDragEnd,
                }}
              />
              {/* NE */}
              <Marker
                ref={(el) => { if (el) overlayCornerMarkersRef.current["ne"] = el; }}
                position={corners.ne}
                draggable={true}
                icon={createOverlayCornerIcon("NE")}
                eventHandlers={{
                  dragstart: () => handleOverlayCornerDragStart("ne", overlayBounds),
                  drag: (e) => handleOverlayCornerDrag("ne", e),
                  dragend: handleOverlayCornerDragEnd,
                }}
              />
              {/* NW */}
              <Marker
                ref={(el) => { if (el) overlayCornerMarkersRef.current["nw"] = el; }}
                position={corners.nw}
                draggable={true}
                icon={createOverlayCornerIcon("NW")}
                eventHandlers={{
                  dragstart: () => handleOverlayCornerDragStart("nw", overlayBounds),
                  drag: (e) => handleOverlayCornerDrag("nw", e),
                  dragend: handleOverlayCornerDragEnd,
                }}
              />
            </>
          );
        })()}

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
                    if (map) map.dragging.disable();
                    overlayMoveStartRef.current = {
                      startLat: e.target.getLatLng().lat,
                      startLng: e.target.getLatLng().lng,
                      initBounds: overlayBounds.map((c) => [...c]),
                    };
                  },
                  drag: (e) => {
                    if (!overlayMoveStartRef.current || !overlayRef.current) return;
                    const { lat, lng } = e.target.getLatLng();
                    const { startLat, startLng, initBounds } = overlayMoveStartRef.current;
                    const dLat = lat - startLat;
                    const dLng = lng - startLng;
                    const newBounds = [
                      [initBounds[0][0] + dLat, initBounds[0][1] + dLng],
                      [initBounds[1][0] + dLat, initBounds[1][1] + dLng],
                    ];
                    // 1. Update Leaflet ImageOverlay directly
                    overlayRef.current.setBounds(newBounds);

                    // 2. Update dashed frame & 4 corners in real-time!
                    const liveCorners = getRotatedBlueprintCorners(newBounds, overlayRotation, unrotatedSpanRef.current);
                    if (liveCorners) {
                      if (overlayFrameRef.current) {
                        overlayFrameRef.current.setLatLngs([liveCorners.nw, liveCorners.ne, liveCorners.se, liveCorners.sw]);
                      }
                      ["nw", "ne", "se", "sw"].forEach((cKey) => {
                        if (overlayCornerMarkersRef.current[cKey]) {
                          overlayCornerMarkersRef.current[cKey].setLatLng(liveCorners[cKey]);
                        }
                      });
                    }
                  },
                  dragend: (e) => {
                    if (map) map.dragging.enable();
                    if (!overlayMoveStartRef.current) return;
                    const { lat, lng } = e.target.getLatLng();
                    const { startLat, startLng, initBounds } = overlayMoveStartRef.current;
                    const dLat = lat - startLat;
                    const dLng = lng - startLng;
                    const finalBounds = [
                      [initBounds[0][0] + dLat, initBounds[0][1] + dLng],
                      [initBounds[1][0] + dLat, initBounds[1][1] + dLng],
                    ];
                    setOverlayBounds(finalBounds);
                    overlayMoveStartRef.current = null;

                    if (selectedProperty && rawOverlayRef.current) {
                      saveBlueprintOverlay(selectedProperty, {
                        rawImage: rawOverlayRef.current,
                        originalImage: originalUploadedImageRef.current || rawOverlayRef.current,
                        bounds: finalBounds,
                        rotation: overlayRotation,
                        opacity: overlayOpacity,
                        lineColor: overlayLineColor,
                        multiply: overlayMultiply,
                        unrotatedSpan: unrotatedSpanRef.current,
                      });
                    }
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

          const lats = coords.map((c) => c[0]);
          const lngs = coords.map((c) => c[1]);
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
            <React.Fragment key={`lot-node-${lot.lot_id}-${lot.status}`}>
              <Polygon
                key={`poly-${lot.lot_id}-${lot.status}`}
                positions={coords}
                pathOptions={{
                  color: isBulkShifting ? "#3b82f6" : statusColor,
                  fillColor: isBulkShifting ? "#3b82f6" : statusColor,
                  fillOpacity: isBulkShifting ? 0.65 : 0.6,
                  weight: isBulkShifting ? 2.5 : 2,
                  dashArray: isBulkShifting ? "4, 4" : undefined,
                  className: isBulkShifting ? "cursor-grab active:cursor-grabbing" : undefined,
                }}
                eventHandlers={{
                  mousedown: (e) => {
                    if (isBulkShifting && map) {
                      if (e?.originalEvent) {
                        e.originalEvent.stopPropagation();
                        e.originalEvent.preventDefault();
                      }
                      map.dragging.disable();
                      const startPoint = e.latlng;
                      const initOffset = { ...bulkShiftOffset };

                      const handleMove = (moveEvent) => {
                        const dLat = moveEvent.latlng.lat - startPoint.lat;
                        const dLng = moveEvent.latlng.lng - startPoint.lng;
                        setBulkShiftOffset({
                          lat: initOffset.lat + dLat,
                          lng: initOffset.lng + dLng,
                        });
                      };

                      const handleUp = () => {
                        map.dragging.enable();
                        map.off("mousemove", handleMove);
                        map.off("mouseup", handleUp);
                      };

                      map.on("mousemove", handleMove);
                      map.on("mouseup", handleUp);
                    }
                  },
                  click: (e) => {
                    if (isBulkShifting) return;
                    handleLotClick(e);
                  },
                }}
              />

              {!isBulkShifting && (
                <Marker
                  key={`pin-${lot.lot_id}-${lot.status}-${centerLat.toFixed(6)}-${centerLng.toFixed(6)}`}
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
                  const currentCoords =
                    dragCoordsRef.current &&
                    dragCoordsRef.current.length === editingCoords.length
                      ? dragCoordsRef.current
                      : editingCoords;
                  const initialCoords = currentCoords.map((c) => [...c]);
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
                    if (!dragCoordsRef.current || dragCoordsRef.current.length !== editingCoords.length) {
                      dragCoordsRef.current = editingCoords.map((c) => [...c]);
                    }
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

        {/* ── Road & Map Text Annotations (Visible on Super Close 19.5+ OR always when Editing Panel is Open) ── */}
        {(showAnnotationPanel || currentZoom >= 19.5) &&
          allPropertiesAnnotations.map((item) => {
            const isThisPropActive =
              Number(item.property_id) === Number(selectedProperty);
            const isInteractive =
              isEditingAnnotations && showAnnotationPanel && isThisPropActive;
            return (
              <Marker
                key={`${item.property_id || "p"}-${item.id}`}
                position={[item.lat, item.lng]}
                draggable={isInteractive}
                icon={createRoadLabelIcon(
                  item,
                  isInteractive,
                  activeAnnotationId === item.id && isThisPropActive
                )}
                eventHandlers={{
                  click: () => {
                    if (
                      item.property_id &&
                      Number(item.property_id) !== Number(selectedProperty)
                    ) {
                      setSelectedProperty(item.property_id);
                    }
                    setActiveAnnotationId(item.id);
                    setShowAnnotationPanel(true);
                  },
                  dragend: (e) => {
                    if (isInteractive) {
                      const { lat, lng } = e.target.getLatLng();
                      handleUpdateAnnotation(item.id, { lat, lng });
                    }
                  },
                }}
              />
            );
          })}
      </MapContainer>

      {/* Floating Coordinate Editor Panel — Eye-Friendly Executive Glassmorphic Design */}
      {editingLot && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl p-3.5 z-[999] flex flex-col gap-2.5 transition-all duration-200 w-11/12 max-w-lg text-slate-200">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0"></div>
              <span className="font-bold text-white text-xs sm:text-sm truncate" title={editingLot.lot_number}>
                Lot {editingLot.lot_number}
              </span>

              {/* Clean Area Badge */}
              <div
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700 text-emerald-400 text-xs font-semibold shrink-0"
                title={
                  targetAreaSqm > 0
                    ? `Area: ${liveAreaSqm.toFixed(1)} m² (Target: ${targetAreaSqm} m²)`
                    : `Area: ${liveAreaSqm.toFixed(1)} m²`
                }
              >
                <Ruler className="w-3 h-3 text-emerald-400" />
                <span>{liveAreaSqm.toFixed(1)} m²</span>
                {targetAreaSqm > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                    / {targetAreaSqm} m²
                  </span>
                )}
              </div>
            </div>

            {/* Quick Size Scale Adjusters */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleScaleEditingCoords(0.85)}
                className="px-2 py-1 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Shrink size (-15%)"
              >
                -15%
              </button>
              <button
                type="button"
                onClick={() => handleScaleEditingCoords(1.15)}
                className="px-2 py-1 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Enlarge size (+15%)"
              >
                +15%
              </button>
              <button
                type="button"
                onClick={() => handleResetToSquareSize(targetAreaSqm || 100)}
                className="px-2 py-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                title={`Reset to neat ${targetAreaSqm || 100}m² square`}
              >
                📐 Fit {targetAreaSqm || 100}m²
              </button>
            </div>

            {/* Subtle Magnet Snapping Toggle */}
            <button
              type="button"
              onClick={() => setEnableSnapping((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none shrink-0 ${
                enableSnapping
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm"
                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
              title="Magnetic Snapping to nearby corners"
            >
              <Magnet className={`w-3.5 h-3.5 ${enableSnapping ? "text-indigo-400" : "text-slate-400"}`} />
              <span>Snap {enableSnapping ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => handleDuplicateLot()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Clone this lot & position adjacent"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Duplicate</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingLot(null)}
                className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVisualCoords}
                disabled={isSavingCoords}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                {isSavingCoords ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleSaveAndAddNext}
                disabled={isSavingCoords}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Save coordinates and immediately start tracing the next adjacent lot!"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save & Next</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draggable Quick Add Lot Modal */}
      {showQuickAddLot && !isBulkShifting && typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              left: `${floatingPos.x}px`,
              top: `${floatingPos.y}px`,
              zIndex: 999999,
            }}
            className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl p-5 w-88 text-slate-200 select-none cursor-default animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Draggable Header */}
            <div
              onMouseDown={handleFloatingMouseDown}
              className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800 cursor-move active:cursor-grabbing select-none"
              title="Hold and drag to move this box"
            >
              <div className="flex items-center gap-2.5">
                <GripHorizontal className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-white text-sm tracking-wide">Quick Add Lot</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddLot(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickLot} className="space-y-3.5 cursor-default">
              {/* Lot Number Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Lot Identifier / Number
                </label>
                <input
                  type="text"
                  required
                  value={quickLotNumber}
                  onChange={(e) => setQuickLotNumber(e.target.value)}
                  placeholder="e.g. Lot 1"
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold cursor-text shadow-inner"
                  autoFocus
                />
              </div>

              {/* Area (SQM) Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Area (m²)</label>
                  <div className="flex items-center gap-1">
                    {[100, 120, 150].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setQuickAreaSqm(sz)}
                        className={`text-[11px] px-1.5 py-0.5 rounded-md border transition-all cursor-pointer font-semibold ${
                          Number(quickAreaSqm) === sz
                            ? "bg-blue-600 text-white border-blue-500 shadow-sm font-bold"
                            : "bg-slate-800/90 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700"
                        }`}
                      >
                        {sz}m²
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={quickAreaSqm}
                  onChange={(e) => setQuickAreaSqm(e.target.value)}
                  placeholder="100"
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold cursor-text shadow-inner"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
                  {[
                    { key: "Available", label: "Available" },
                    { key: "Pending", label: "Pending" },
                    { key: "Sold", label: "Sold" },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setQuickStatus(st.key)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        quickStatus === st.key
                          ? "bg-slate-700 text-white border-slate-600 shadow-sm ring-1 ring-white/10"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Action Button */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowQuickAddLot(false)}
                  className="flex-1 py-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuickLot}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isCreatingQuickLot ? (
                    <span>Placing...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Place Lot</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Floating Bulk Shift Alignment Editor Panel */}
      {isBulkShifting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-4 z-[9999] flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 w-11/12 max-w-xl text-slate-200">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="font-bold text-white text-sm">
                Move All Lots Together
              </span>
            </div>
            <span className="text-xs text-slate-400 block mt-1 leading-relaxed">
              Click & drag any lot directly on the map, or use the nudge buttons below to slide all lots into alignment.
            </span>

            {/* Micro Nudge Steppers */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Nudge:</span>
              <button
                type="button"
                onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lat: prev.lat + 0.00003 }))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Nudge Up (North)"
              >
                ▲ Up
              </button>
              <button
                type="button"
                onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lat: prev.lat - 0.00003 }))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Nudge Down (South)"
              >
                ▼ Down
              </button>
              <button
                type="button"
                onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lng: prev.lng - 0.00003 }))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Nudge Left (West)"
              >
                ◄ Left
              </button>
              <button
                type="button"
                onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lng: prev.lng + 0.00003 }))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Nudge Right (East)"
              >
                ► Right
              </button>
              {(bulkShiftOffset.lat !== 0 || bulkShiftOffset.lng !== 0) && (
                <button
                  type="button"
                  onClick={() => setBulkShiftOffset({ lat: 0, lng: 0 })}
                  className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs underline cursor-pointer ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              onClick={handleSaveBulkShift}
              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer text-center"
            >
              Save All Lots
            </button>
            <button
              onClick={() => {
                setIsBulkShifting(false);
                setBulkShiftOffset({ lat: 0, lng: 0 });
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
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
        onDuplicateLot={(lot) => {
          setIsOffcanvasOpen(false);
          handleDuplicateLot(lot);
        }}
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
          overlayMultiply={overlayMultiply}
          overlayLineColor={overlayLineColor}
          overlayLineBoldness={overlayLineBoldness}
          onLineColorChange={handleLineColorChange}
          onLineBoldnessChange={handleLineBoldnessChange}
          isBulkShifting={isBulkShifting}
          onImageUpload={handleImageUpload}
          onOpacityChange={setOverlayOpacity}
          onToggleMultiply={async () => {
            const next = !overlayMultiply;
            setOverlayMultiply(next);
            if (next) {
              if (!transparentOverlayRef.current && rawOverlayRef.current) {
                transparentOverlayRef.current = await createTransparentPaperImage(rawOverlayRef.current, overlayLineColor, overlayRotation, overlayLineBoldness);
              }
              if (transparentOverlayRef.current) {
                setOverlayImage(transparentOverlayRef.current);
              }
            } else {
              if (rawOverlayRef.current) {
                setOverlayImage(rawOverlayRef.current);
              }
            }
          }}
          onRotationChange={handleRotationChange}
          onRotate90={(delta) => handleRotationChange((overlayRotation + delta) % 360)}
          onReset={handleResetOverlay}
          onScaleOverlay={handleScaleOverlay}
          onOpenCrop={() => setIsCropModalOpen(true)}
          onToggleVisible={() => setOverlayVisible((prev) => !prev)}
          onToggleEdit={() => setIsEditingOverlay((prev) => !prev)}
          onToggleBulkShift={() => {
            setIsBulkShifting((prev) => !prev);
            setBulkShiftOffset({ lat: 0, lng: 0 });
          }}
          onRemove={async () => {
            if (overlayImage && overlayImage.startsWith("blob:")) {
              try { URL.revokeObjectURL(overlayImage); } catch (e) {}
            }
            setOverlayImage(null);
            setOverlayBounds(null);
            setIsEditingOverlay(false);
            setOverlayRotation(0);
            rawOverlayRef.current = null;
            originalUploadedImageRef.current = null;
            transparentOverlayRef.current = null;
            unrotatedSpanRef.current = null;
            if (selectedProperty) {
              await removeBlueprintOverlay(selectedProperty);
            }
          }}
          onClose={() => setShowOverlayPanel(false)}
        />
      )}

      {/* ── Visual Blueprint Cropping Modal ──────────────────────────── */}
      <BlueprintCropModal
        isOpen={isCropModalOpen}
        imageUrl={originalUploadedImageRef.current || rawOverlayRef.current}
        onApplyCrop={handleApplyCrop}
        onClose={() => setIsCropModalOpen(false)}
      />

      {/* ── Road & Map Labels Floating Control ───────────────────────── */}
      {showAnnotationPanel && (
        <MapAnnotationControl
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          onSelectAnnotation={(id) => setActiveAnnotationId(id)}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          onSaveAnnotations={handleSaveAnnotations}
          isSaving={isSavingAnnotations}
          isEditing={isEditingAnnotations}
          onToggleEditing={() => setIsEditingAnnotations((prev) => !prev)}
          onClose={() => setShowAnnotationPanel(false)}
        />
      )}
    </div>
  );
}

export default AdminViewMap;
