import React, { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import L from "leaflet";
import { API_BASE_URL } from "../../../../config/api";
import { showToast } from "../../../../components/GlobalToast";
import { useBlueprintLotImport } from "../../../../hooks/useBlueprintLotImport";
import { waitForPropertyFlight } from "../../../../hooks/usePropertyMapNavigation";
import { getLotBounds } from "../../../../utils/lotViewport";
import {
  projectBlueprintRoadLabel,
  reframeBlueprintCrop,
  calculateReviewViewportFromMap
} from "../../../../utils/blueprintLotProjection";
import { mergeGeneratedRoadAnnotations } from "../../../../utils/pdfLotImport/roadLabels";
import { MAP_LAYERS } from "../../../../components/admin/MapLayerControls";
import {
  geocodeAddress,
  MUNICIPALITY_COORDINATES,
  DEFAULT_COORDINATES_MAP,
} from "../../../../utils/geocoding";
import {
  calculateGeodesicArea,
  autoIncrementLotNumber,
  findSnapVertex,
  offsetPolygonAdjacent,
} from "../../../../utils/geoUtils";
import {
  saveBlueprintOverlay,
  loadBlueprintOverlay,
  removeBlueprintOverlay,
} from "../../../../utils/overlayStorage";
import {
  toDataURL,
  generateSourceRevision,
  createTransparentPaperBlob,
  createTransparentPaperImage
} from "../utils/blueprintPaperProcessing";
import {
  getAuthConfig,
  STATUS_COLORS,
  isNonSaleableLot,
  getStatusColor
} from "../utils/mapConstants";
import { Marker } from "react-leaflet";
import { LotPlanPin } from "../../../../components/admin/LotPlanPin";
import { LotPlanPolygon } from "../../../../components/admin/LotPlanPolygon";
import { createOverviewPropertyIcon } from "../layers/OverviewBeaconsLayer";

export const useAdminViewMap = () => {
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

  // Refs for smooth vertex dragging
  const editingPolygonRef = React.useRef(null);
  const dragCoordsRef = React.useRef([]);
  const cornerMarkersRef = React.useRef([]); // stores refs to Leaflet Marker instances for direct DOM positioning during drag
  const centerMoveMarkerRef = React.useRef(null);

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
  const [overlayLineColor, setOverlayLineColor] = useState("lime"); // High-contrast CAD color (default to lime)
  const [overlayLineBoldness, setOverlayLineBoldness] = useState("super_fine"); // super_fine (hairline), fine, normal, bold
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [duplicateModalData, setDuplicateModalData] = useState(null);
  const originalUploadedImageRef = React.useRef(null);
  const rawOverlayRef = React.useRef(null);
  const transparentOverlayRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const overlayFrameRef = React.useRef(null);
  const overlayCornerMarkersRef = React.useRef({});
  const overlayMoveStartRef = React.useRef(null);
  const overlayCornerDragRef = React.useRef(null); // stores {initBounds, currentBounds} during corner drag
  const unrotatedSpanRef = React.useRef(null);
  const overlayOperationRef = useRef(0);
  const activeOverlayPropertyRef = useRef(selectedProperty);
  activeOverlayPropertyRef.current = selectedProperty;
  const overlayBlobCacheRef = useRef(new Map());
  const activeOverlayUrlRef = useRef(null);
  const [isPreparingOverlay, setIsPreparingOverlay] = useState(false);
  const reviewViewportRef = useRef(null);
  const lotImport = useBlueprintLotImport({
    propertyId: selectedProperty, map, bounds: overlayBounds, rotation: overlayRotation,
    isAligning: isEditingOverlay || isPreparingOverlay,
  });
  const { restore: restoreLotImport, applyCrop: applyLotImportCrop } = lotImport;

  const handleOpenReview = useCallback(() => {
    if (!reviewViewportRef.current && map && overlayBounds && lotImport.draft) {
      reviewViewportRef.current = calculateReviewViewportFromMap(
        map,
        lotImport.draft,
        overlayBounds,
        overlayRotation
      );
    }
    lotImport.openReview();
  }, [map, overlayBounds, overlayRotation, lotImport]);

  // ── Road & Map Text Labels (Annotations) States ───────────────────────────
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const [isEditingAnnotations, setIsEditingAnnotations] = useState(true);
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isSavingAnnotations, setIsSavingAnnotations] = useState(false);

  const automaticRoadAnnotations = useMemo(() => {
    if (!map || !overlayBounds || !lotImport.draft?.roadLabels?.length) return [];
    return lotImport.draft.roadLabels.map((label) => projectBlueprintRoadLabel(
      { ...label, sourceName: lotImport.draft.sourceName }, lotImport.draft,
      overlayBounds, overlayRotation, map,
    )).filter(Boolean);
  }, [map, overlayBounds, overlayRotation, lotImport.draft]);

  // ── Draggable Floating Unified Lot States ──────────────────────────────────
  const [quickLotNumber, setQuickLotNumber] = useState("");
  const [quickAreaSqm, setQuickAreaSqm] = useState(100);
  const [quickStatus, setQuickStatus] = useState("Available");
  const [floatingPos, setFloatingPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 190)) : 380,
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
    const nextNum = getNextSuggestedLotNumber();
    const area = 100;
    setQuickLotNumber(nextNum);
    setQuickAreaSqm(area);
    setQuickStatus("Available");
    setFloatingPos({
      x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 190)) : 380,
      y: 110,
    });

    // Compute initial square coords immediately at current map center or property coords
    const currentCenter = map ? map.getCenter() : null;
    let baseCoords = null;
    if (currentCenter) {
      baseCoords = [currentCenter.lat, currentCenter.lng];
    } else {
      const prop = mapData?.properties?.find((p) => Number(p.property_id || p.id) === Number(selectedProperty));
      if (prop?.coordinates) {
        baseCoords = typeof prop.coordinates === "string" ? JSON.parse(prop.coordinates) : prop.coordinates;
      }
      if (!baseCoords) {
        baseCoords = DEFAULT_COORDINATES_MAP[selectedProperty] || [10.7372, 122.3857];
      }
    }

    const sideMeters = Math.sqrt(area);
    const latRad = (baseCoords[0] * Math.PI) / 180;
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

    const initCoords = corners.map(([dy, dx]) => {
      const rotY = dy * cosR - dx * sinR;
      const rotX = dy * sinR + dx * cosR;
      return [baseCoords[0] + rotY, baseCoords[1] + rotX];
    });

    dragCoordsRef.current = initCoords.map((c) => [...c]);
    setEditingCoords(initCoords);

    setEditingLot({
      isNew: true,
      lot_number: nextNum,
      area_sqm: area,
      status: "Available",
      property_id: parseInt(selectedProperty),
    });
  }, [getNextSuggestedLotNumber, map, mapData, selectedProperty, overlayRotation]);

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
      const isSelected = Number(p.property_id) === Number(selectedProperty);
      if (isSelected) {
        const visibleAnnotations = isEditingOverlay
          ? annotations.filter((a) => a.autoGenerated !== "pdf-road")
          : annotations;
        result.push(...visibleAnnotations.map((a) => ({ ...a, property_id: p.property_id })));
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
    return result.filter((item) => !item.deleted);
  }, [mapData, selectedProperty, annotations, isEditingOverlay]);

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

  // Listen for openMoveAllLots event from AdminHeader Manage Lots
  useEffect(() => {
    const handleOpenMoveAllLotsEvent = () => {
      setIsBulkShifting((prev) => !prev);
      setBulkShiftOffset({ lat: 0, lng: 0 });
    };
    window.addEventListener("openMoveAllLots", handleOpenMoveAllLotsEvent);
    return () =>
      window.removeEventListener("openMoveAllLots", handleOpenMoveAllLotsEvent);
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
      color: "#e2e8f0",
    };
    setAnnotations((prev) => [...prev, newLabel]);
    setActiveAnnotationId(newId);
    setIsEditingAnnotations(true);
    setShowAnnotationPanel(true);
  }, [map, annotations.length, selectedProperty]);

  const handleUpdateAnnotation = useCallback((id, updates) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates,
        ...(a.autoGenerated === "pdf-road" ? { pdfOverrides: { ...a.pdfOverrides, ...updates } } : {}) } : a))
    );
  }, []);

  const handleUpdateAllAnnotations = useCallback((updates) => {
    setAnnotations((prev) =>
      prev.map((a) => (!a.deleted ? {
        ...a,
        ...updates,
        ...(a.autoGenerated === "pdf-road" ? { pdfOverrides: { ...a.pdfOverrides, ...updates } } : {})
      } : a))
    );
  }, []);

  const handleDeleteAnnotation = useCallback(
    (id) => {
      setAnnotations((prev) => prev.flatMap((a) => a.id !== id ? [a] : a.autoGenerated === "pdf-road" ? [{ ...a, deleted: true }] : []));
      if (activeAnnotationId === id) {
        setActiveAnnotationId(null);
      }
    },
    [activeAnnotationId]
  );

  const handleDeleteAllAnnotations = useCallback(() => {
    setAnnotations((prev) =>
      prev.flatMap((a) => (a.autoGenerated === "pdf-road" ? [{ ...a, deleted: true }] : []))
    );
    setActiveAnnotationId(null);
  }, []);

  const createRoadLabelIcon = useCallback((item, isEditing, isSelected) => {
    // Scaling is handled by CSS variable --road-label-scale (set on map container)
    return L.divIcon({
      className: "map-road-label-icon",
      html: `
        <div class="map-road-label-inner" style="
          position: absolute;
          left: 0;
          top: 0;
          transform: translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(var(${item.scaleWithMap ? '--pdf-road-label-scale' : '--road-label-scale'}, 1));
          transform-origin: center center;
          color: ${item.color || '#e2e8f0'};
          font-size: ${item.fontSize || 12}px;
          font-weight: 700;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: ${item.scaleWithMap ? '0' : '0.8px'};
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
          <span>${String(item.text || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</span>
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
      const newX = Math.max(10, Math.min(window.innerWidth - 380, moveEvent.clientX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 480, moveEvent.clientY - dragOffsetRef.current.y));
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

  // ── Bulk Shift States ──────────────────────────────────────────────────────
  const [isBulkShifting, setIsBulkShifting] = useState(false);
  const [bulkShiftOffset, setBulkShiftOffset] = useState({ lat: 0, lng: 0 });
  const [pendingBulkShift, setPendingBulkShift] = useState(false);
  const [isBulkShiftSubmitting, setIsBulkShiftSubmitting] = useState(false);
  const [bulkShiftError, setBulkShiftError] = useState("");
  const [bulkShiftSuccessMessage, setBulkShiftSuccessMessage] = useState("");

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
      if (centerMoveMarkerRef.current) {
        centerMoveMarkerRef.current.setLatLng(getPolygonCentroid(dragCoordsRef.current));
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
    if (centerMoveMarkerRef.current) {
      centerMoveMarkerRef.current.setLatLng(getPolygonCentroid(updated));
    }
  };

  // Remove a vertex by index (triggered by double-clicking a corner handle)
  const handleRemoveVertex = (index) => {
    if (editingCoords.length <= 3) {
      showToast("A polygon must have at least 3 corners.", "warning");
      return;
    }
    const base = dragCoordsRef.current?.length === editingCoords.length ? dragCoordsRef.current : editingCoords;
    const newCoords = base.filter((_, idx) => idx !== index);
    dragCoordsRef.current = newCoords.map((c) => [...c]);
    setEditingCoords(newCoords);
    if (editingPolygonRef.current) {
      editingPolygonRef.current.setLatLngs(newCoords);
    }
    if (centerMoveMarkerRef.current) {
      centerMoveMarkerRef.current.setLatLng(getPolygonCentroid(newCoords));
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
    if (centerMoveMarkerRef.current) {
      centerMoveMarkerRef.current.setLatLng(getPolygonCentroid(newCoords));
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

  // Helper: Computes centroid of a polygon coordinate array
  const getPolygonCentroid = (coords) => {
    if (!coords || coords.length === 0) return [0, 0];
    let sumLat = 0;
    let sumLng = 0;
    for (let i = 0; i < coords.length; i++) {
      sumLat += coords[i][0];
      sumLng += coords[i][1];
    }
    return [sumLat / coords.length, sumLng / coords.length];
  };

  // Create an explicit center move icon for grabbing and dragging the entire lot
  const createPolygonCenterMoveIcon = () => {
    return L.divIcon({
      className: "custom-polygon-center-icon",
      html: `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.9);
          border: 2px solid #10b981;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 10px rgba(16, 185, 129, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: move;
          color: #10b981;
          user-select: none;
        " title="Drag to move entire lot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="5 9 2 12 5 15"></polyline>
            <polyline points="9 5 12 2 15 5"></polyline>
            <polyline points="15 19 12 22 9 19"></polyline>
            <polyline points="19 9 22 12 19 15"></polyline>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="12" y1="2" x2="12" y2="22"></line>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
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

  // ── Load Persistent Blueprint Overlay from IndexedDB on Mount or Property Switch ───
  useEffect(() => {
    let isCancelled = false;
    const operation = ++overlayOperationRef.current;
    if (activeOverlayUrlRef.current && activeOverlayUrlRef.current.startsWith("blob:")) {
      try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
      activeOverlayUrlRef.current = null;
    }
    setOverlayImage(null);
    setOverlayBounds(null);
    setIsEditingOverlay(false);
    setIsCropModalOpen(false);
    setIsPreparingOverlay(false);
    rawOverlayRef.current = null;
    originalUploadedImageRef.current = null;
    unrotatedSpanRef.current = null;
    reviewViewportRef.current = null;
    restoreLotImport(null);
    const fetchSavedOverlay = async () => {
      if (!selectedProperty) return;
      try {
        const data = await loadBlueprintOverlay(selectedProperty);
        await waitForPropertyFlight(map);
        if (isCancelled || operation !== overlayOperationRef.current) return;

        if (data && data.rawImage && data.bounds) {
          rawOverlayRef.current = data.rawImage;
          originalUploadedImageRef.current = data.originalImage || data.rawImage;
          unrotatedSpanRef.current = data.unrotatedSpan || null;
          const rotation = data.rotation || 0;
          const opacity = data.opacity ?? 1;
          const lineColor = data.lineColor || "lime";
          const lineBoldness = data.lineBoldness || "super_fine";
          const multiply = data.multiply ?? true;

          setOverlayRotation(rotation);
          setOverlayOpacity(opacity);
          setOverlayLineColor(lineColor);
          setOverlayLineBoldness(lineBoldness);
          setOverlayMultiply(multiply);
          setOverlayBounds(data.bounds);

          // Stable sourceRevision: reuse existing or generate stable token for legacy records
          let sourceRevision = data.sourceRevision;
          if (!sourceRevision) {
            sourceRevision = generateSourceRevision();
          }

          const processedCacheKey = `${selectedProperty}:${sourceRevision}:${rotation}:${lineColor}:${lineBoldness}:${multiply ? 1 : 0}`;

          let displayUrl = null;

          // A. In-memory cache hit: matching cacheKey + Blob
          const memCached = overlayBlobCacheRef.current.get(selectedProperty);
          if (memCached && memCached.cacheKey === processedCacheKey && memCached.blob instanceof Blob) {
            displayUrl = URL.createObjectURL(memCached.blob);
          }

          // B. IndexedDB processedBlob hit: matching processedCacheKey
          if (!displayUrl && data.processedCacheKey === processedCacheKey && data.processedBlob instanceof Blob) {
            overlayBlobCacheRef.current.set(selectedProperty, {
              cacheKey: processedCacheKey,
              blob: data.processedBlob,
            });
            displayUrl = URL.createObjectURL(data.processedBlob);
          }

          // C. Cache miss: generate via canvas processing & persist
          if (!displayUrl) {
            const blob = await createTransparentPaperBlob(data.rawImage, lineColor, rotation, lineBoldness, multiply);
            if (isCancelled || operation !== overlayOperationRef.current) return;

            if (blob) {
              overlayBlobCacheRef.current.set(selectedProperty, {
                cacheKey: processedCacheKey,
                blob,
              });
              displayUrl = URL.createObjectURL(blob);

              // Persist sourceRevision, processedBlob, processedCacheKey without duplicating rawImage
              saveBlueprintOverlay(selectedProperty, {
                sourceRevision,
                processedBlob: blob,
                processedCacheKey,
              });
            } else {
              displayUrl = data.rawImage;
            }
          }

          if (isCancelled || operation !== overlayOperationRef.current) {
            if (displayUrl && displayUrl.startsWith("blob:")) {
              try { URL.revokeObjectURL(displayUrl); } catch (e) {}
            }
            return;
          }

          if (activeOverlayUrlRef.current && activeOverlayUrlRef.current !== displayUrl && activeOverlayUrlRef.current.startsWith("blob:")) {
            try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
          }
          activeOverlayUrlRef.current = displayUrl;

          transparentOverlayRef.current = displayUrl;
          setOverlayImage(displayUrl);
          setOverlayVisible(true);
          restoreLotImport(data.lotImport);
        }
      } catch (err) {
        console.error("Error loading saved blueprint overlay:", err);
      }
    };

    fetchSavedOverlay();
    return () => {
      isCancelled = true;
      if (activeOverlayUrlRef.current && activeOverlayUrlRef.current.startsWith("blob:")) {
        try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
        activeOverlayUrlRef.current = null;
      }
      if (transparentOverlayRef.current && transparentOverlayRef.current.startsWith("blob:")) {
        try { URL.revokeObjectURL(transparentOverlayRef.current); } catch (e) {}
        transparentOverlayRef.current = null;
      }
    };
  }, [selectedProperty, restoreLotImport, map]);

  // Clean up component-scoped overlay blob cache and active blob URL when AdminViewMap unmounts
  useEffect(() => {
    const overlayBlobCache = overlayBlobCacheRef.current;
    return () => {
      if (activeOverlayUrlRef.current && activeOverlayUrlRef.current.startsWith("blob:")) {
        try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
        activeOverlayUrlRef.current = null;
      }
      if (transparentOverlayRef.current && transparentOverlayRef.current.startsWith("blob:")) {
        try { URL.revokeObjectURL(transparentOverlayRef.current); } catch (e) {}
        transparentOverlayRef.current = null;
      }
      if (overlayBlobCache) {
        overlayBlobCache.clear();
      }
    };
  }, []);

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
      if (!Number.isFinite(deg)) return;
      setOverlayRotation(deg);
      const operation = ++overlayOperationRef.current;
      const baseImg = rawOverlayRef.current || originalUploadedImageRef.current;
      if (!baseImg) return;

      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(baseImg, overlayLineColor, deg, overlayLineBoldness, overlayMultiply);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(transUrl); return; }
      setIsPreparingOverlay(false);
      if (transparentOverlayRef.current && transparentOverlayRef.current !== transUrl) {
        try { URL.revokeObjectURL(transparentOverlayRef.current); } catch (e) {}
      }
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);

      let finalBounds = overlayBounds;
      if (overlayBounds) {
        const prev = overlayBounds;
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
        setOverlayBounds(newBounds);
      }

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
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(src, color, overlayRotation, overlayLineBoldness, overlayMultiply);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(transUrl); return; }
      setIsPreparingOverlay(false);
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
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(src, overlayLineColor, overlayRotation, boldness, overlayMultiply);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(transUrl); return; }
      setIsPreparingOverlay(false);
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
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const dataUrl = await toDataURL(croppedUrl);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) return;
      applyLotImportCrop(cropBounds);
      setIsEditingOverlay(true);
      rawOverlayRef.current = dataUrl;
      const cropRotation = lotImport.draft ? overlayRotation : 0;
      setOverlayRotation(cropRotation);
      const transUrl = await createTransparentPaperImage(dataUrl, overlayLineColor, cropRotation, overlayLineBoldness, overlayMultiply);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(transUrl); return; }
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);
      setIsPreparingOverlay(false);

      let finalBounds = overlayBounds;
      let finalSpan = unrotatedSpanRef.current;

      if (overlayBounds && lotImport.draft && map && cropBounds) {
        const reframed = reframeBlueprintCrop(lotImport.draft, cropBounds, overlayBounds, cropRotation, map);
        finalBounds = reframed.bounds;
        finalSpan = reframed.unrotatedSpan;
        unrotatedSpanRef.current = finalSpan;
        if (overlayRef.current) overlayRef.current.setBounds(finalBounds);
        setOverlayBounds(finalBounds);
      } else if (overlayBounds) {
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
        const newRevision = generateSourceRevision();
        overlayBlobCacheRef.current.delete(selectedProperty);
        saveBlueprintOverlay(selectedProperty, {
          rawImage: dataUrl,
          originalImage: originalUploadedImageRef.current || dataUrl,
          bounds: finalBounds,
          rotation: cropRotation,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: finalSpan,
          sourceRevision: newRevision,
        });
      }
    },
    [overlayBounds, overlayLineColor, overlayLineBoldness, selectedProperty, overlayOpacity, overlayMultiply, applyLotImportCrop, lotImport.draft, overlayRotation, map]
  );

  // Reset overlay rotation back to 0° (preserving the cropped blueprint image and scale)
  const handleResetOverlay = useCallback(async () => {
    handleRotationChange(0);
  }, [handleRotationChange]);

  // Handle image upload — place overlay centered on current map view
  const handleImageUpload = useCallback(
    async (imageUrl, importSource = null, originalImageUrl = imageUrl) => {
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const dataUrl = await toDataURL(imageUrl);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) return;
      if (rawOverlayRef.current && rawOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(rawOverlayRef.current);
      }
      if (transparentOverlayRef.current && transparentOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(transparentOverlayRef.current);
      }

      originalUploadedImageRef.current = originalImageUrl || dataUrl;
      rawOverlayRef.current = dataUrl;
      setOverlayRotation(0);

      const transUrl = await createTransparentPaperImage(dataUrl, overlayLineColor, 0, overlayLineBoldness, overlayMultiply);
      if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(transUrl); return; }
      transparentOverlayRef.current = transUrl;
      restoreLotImport(importSource);
      setIsPreparingOverlay(false);
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
        const newRevision = generateSourceRevision();
        overlayBlobCacheRef.current.delete(selectedProperty);
        saveBlueprintOverlay(selectedProperty, {
          rawImage: dataUrl,
          originalImage: originalUploadedImageRef.current,
          lotImport: importSource,
          bounds: initBounds,
          rotation: 0,
          opacity: overlayOpacity,
          lineColor: overlayLineColor,
          multiply: overlayMultiply,
          unrotatedSpan: initSpan,
          sourceRevision: newRevision,
        });
      }
    },
    [map, overlayLineColor, overlayLineBoldness, selectedProperty, overlayOpacity, overlayMultiply, restoreLotImport]
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

  // Save bulk shifted coordinates to database (opens in-app confirmation modal)
  const handleOpenBulkShiftConfirm = () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setIsBulkShifting(false);
      return;
    }
    setBulkShiftError("");
    setPendingBulkShift(true);
  };

  const handleCloseBulkShiftConfirm = () => {
    if (isBulkShiftSubmitting) return;
    setPendingBulkShift(false);
    setBulkShiftError("");
  };

  const confirmBulkShift = async () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setPendingBulkShift(false);
      setIsBulkShifting(false);
      return;
    }

    setIsBulkShiftSubmitting(true);
    setBulkShiftError("");

    try {
      await axios.put(`${API_BASE_URL}/api/lots/property/${selectedProperty}/bulk-shift`, {
        deltaLat: bulkShiftOffset.lat,
        deltaLng: bulkShiftOffset.lng,
      });

      // Shift local annotations state as well so UI updates immediately
      if (annotations && annotations.length > 0) {
        setAnnotations((prev) =>
          prev.map((a) =>
            typeof a.lat === "number" && typeof a.lng === "number"
              ? { ...a, lat: a.lat + bulkShiftOffset.lat, lng: a.lng + bulkShiftOffset.lng }
              : a
          )
        );
      }

      setPendingBulkShift(false);
      setBulkShiftSuccessMessage("All lots and road labels have been moved and saved successfully!");
      setTimeout(() => setBulkShiftSuccessMessage(""), 4000);

      // Reload map data to get fresh coordinates from database
      await handleLotUpdated();
      setIsBulkShifting(false);
      setBulkShiftOffset({ lat: 0, lng: 0 });
    } catch (err) {
      console.error("Error bulk shifting lots and road labels:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to bulk shift lots";
      setBulkShiftError(errorMsg);
    } finally {
      setIsBulkShiftSubmitting(false);
    }
  };

  const handleSaveBulkShift = handleOpenBulkShiftConfirm;

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

  // Cache each polygon's bounds once per data refresh for cheap viewport filtering.
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots
      .filter((lot) => activePropertyIds.has(Number(lot.property_id)))
      .map((lot) => {
        const bounds = getLotBounds(lot.coordinates);
        if (!bounds) return lot;
        return {
          ...lot,
          _bounds: bounds,
          _statusColor: getStatusColor(lot.status, lot.lot_number, lot.area_sqm),
          _nonSaleable: isNonSaleableLot(lot.lot_number, lot.area_sqm),
          _centerLat: (bounds.south + bounds.north) / 2,
          _centerLng: (bounds.west + bounds.east) / 2,
        };
      });
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




  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const authConfig = getAuthConfig();
        const [mapResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, authConfig),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, authConfig);
                return {
                  ...lot,
                  customer: lotDetails.data.customer,
                  agent_name: lotDetails.data.agent_name,
                  employee_id: lotDetails.data.employee_id,
                  payment_method: lotDetails.data.payment_method,
                };
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
      const authConfig = getAuthConfig();
      const mapResponse = await axios.get(`${API_BASE_URL}/api/lots/map-data`, authConfig);

      // Fetch customer details for all pending/sold lots
      const lotsWithCustomerData = await Promise.all(
        mapResponse.data.lots.map(async (lot) => {
          if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
            try {
              const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, authConfig);
              return {
                ...lot,
                customer: lotDetails.data.customer,
                agent_name: lotDetails.data.agent_name,
                employee_id: lotDetails.data.employee_id,
                payment_method: lotDetails.data.payment_method,
              };
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

  // Handle immediate visual lot update when toggling classification in LotOffcanvas
  const handleLiveLotUpdate = useCallback((updatedFields) => {
    if (!selectedLot) return;
    const updated = { ...selectedLot, ...updatedFields };
    setSelectedLot(updated);
    setMapData((prev) => {
      if (!prev || !Array.isArray(prev.lots)) return prev;
      return {
        ...prev,
        lots: prev.lots.map((l) =>
          Number(l.lot_id) === Number(updated.lot_id)
            ? { ...l, ...updatedFields }
            : l
        ),
      };
    });
  }, [selectedLot]);

  const persistAnnotations = useCallback(async (nextAnnotations, notify = false) => {
    if (!selectedProperty) return;
    setIsSavingAnnotations(true);
    try {
      await axios.put(
        `${API_BASE_URL}/api/properties/${selectedProperty}/annotations`,
        { annotations: nextAnnotations },
        getAuthConfig()
      );
      if (notify) showToast("Road & map labels saved successfully to database!", "success");
      await handleLotUpdated();
      return true;
    } catch (err) {
      console.error("Error saving map annotations:", err);
      showToast(err.response?.data?.error || "Blueprint aligned, but the road labels could not be saved. Open Road Labels and try Save again.", "error");
      return false;
    } finally {
      setIsSavingAnnotations(false);
    }
  }, [selectedProperty, handleLotUpdated]);

  const handleSaveAnnotations = useCallback(async () => {
    await persistAnnotations(annotations, true);
  }, [annotations, persistAnnotations]);

  const handleToggleOverlayEdit = useCallback(async () => {
    if (isSavingAnnotations) return;
    const isLocking = isEditingOverlay;
    setIsEditingOverlay((previous) => !previous);
    if (!isLocking || !automaticRoadAnnotations.length) return;
    const merged = mergeGeneratedRoadAnnotations(annotations, automaticRoadAnnotations);
    setAnnotations(merged);
    await persistAnnotations(merged);
  }, [isEditingOverlay, annotations, automaticRoadAnnotations, persistAnnotations, isSavingAnnotations]);

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
      const { lot_id, lot_number, property_id, coordinates, area_sqm, status } = event.detail;
      const found = mapData?.lots?.find((l) => Number(l.lot_id) === Number(lot_id));
      const lotStatus = status || found?.status || "Available";
      const lotNum = lot_number || found?.lot_number || "";
      const lotArea = parseFloat(area_sqm || found?.area_sqm) || 100;

      setEditingLot({
        lot_id,
        lot_number: lotNum,
        property_id: property_id || selectedProperty,
        area_sqm: lotArea,
        status: lotStatus,
        isNew: false,
      });
      setQuickLotNumber(lotNum);
      setQuickAreaSqm(lotArea);
      setQuickStatus(lotStatus);

      let parsedCoords = coordinates;
      if (typeof parsedCoords === "string") {
        try {
          parsedCoords = JSON.parse(parsedCoords);
        } catch (e) {
          parsedCoords = null;
        }
      }

      // Check mapData as defensive fallback if coordinates wasn't provided or was empty
      if (!parsedCoords || !Array.isArray(parsedCoords) || parsedCoords.length === 0) {
        const found = mapData?.lots?.find((l) => Number(l.lot_id) === Number(lot_id));
        if (found?.coordinates) {
          parsedCoords =
            typeof found.coordinates === "string"
              ? JSON.parse(found.coordinates)
              : found.coordinates;
        }
      }

      let initCoords = [];
      if (parsedCoords && Array.isArray(parsedCoords) && parsedCoords.length > 0) {
        initCoords = parsedCoords.map((c) => [...c]);
      } else {
        // Use current active map center if available so coordinates appear exactly where user is focused
        const currentCenter = map ? map.getCenter() : null;
        let baseCoords = null;
        if (currentCenter) {
          baseCoords = [currentCenter.lat, currentCenter.lng];
        } else {
          const prop = mapData?.properties?.find(
            (p) => Number(p.property_id || p.id) === Number(property_id || selectedProperty)
          );
          if (prop?.coordinates) {
            baseCoords =
              typeof prop.coordinates === "string"
                ? JSON.parse(prop.coordinates)
                : prop.coordinates;
          }
          if (!baseCoords) {
            baseCoords = DEFAULT_COORDINATES_MAP[selectedProperty] || [10.7372, 122.3857];
          }
        }

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
  }, [map, mapData, selectedProperty, overlayRotation]);

  // Handle dragging the entire polygon shape with immediate synchronous pointer tracking & magnetic snapping
  const startPolygonDrag = useCallback((startLatLng) => {
    if (!map) return;
    map.dragging.disable();

    const currentCoords =
      dragCoordsRef.current && dragCoordsRef.current.length === editingCoords.length
        ? dragCoordsRef.current
        : editingCoords;
    const initialCoords = currentCoords.map((c) => [...c]);
    polygonDragRef.current = { startLatLng, initialCoords };
    setIsDraggingPolygon(true);

    let currentCandidate = null;

    const onGlobalMouseMove = (e) => {
      let mouseLatLng = e.latlng;
      if (!mouseLatLng && typeof e.clientX === "number" && typeof e.clientY === "number") {
        try {
          mouseLatLng = map.mouseEventToLatLng(e);
        } catch (err) {
          return;
        }
      }
      if (!mouseLatLng) return;

      const deltaLat = mouseLatLng.lat - startLatLng.lat;
      const deltaLng = mouseLatLng.lng - startLatLng.lng;

      let candidateCoords = initialCoords.map(([lat, lng]) => [
        lat + deltaLat,
        lng + deltaLng,
      ]);

      // Magnetic snapping for the entire polygon
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

      // Direct Leaflet element updates for 60 FPS movement
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

      // Center move marker update
      if (centerMoveMarkerRef.current) {
        centerMoveMarkerRef.current.setLatLng(getPolygonCentroid(candidateCoords));
      }

      dragCoordsRef.current = candidateCoords.map((c) => [...c]);
      currentCandidate = candidateCoords;
    };

    const onGlobalMouseUp = () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
      map.off("mousemove", onGlobalMouseMove);
      map.off("mouseup", onGlobalMouseUp);

      setIsDraggingPolygon(false);
      polygonDragRef.current = null;
      if (map) {
        map.dragging.enable();
      }

      if (currentCandidate) {
        const finalCoords = currentCandidate.map((c) => [...c]);
        dragCoordsRef.current = finalCoords.map((c) => [...c]);
        setEditingCoords(finalCoords);
      }
    };

    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);
    map.on("mousemove", onGlobalMouseMove);
    map.on("mouseup", onGlobalMouseUp);
  }, [map, editingCoords, enableSnapping, mapData, editingLot]);

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
    let cLat, cLng;
    if (editingCoords && editingCoords.length > 0) {
      let sumLat = 0;
      let sumLng = 0;
      editingCoords.forEach(([lat, lng]) => {
        sumLat += lat;
        sumLng += lng;
      });
      cLat = sumLat / editingCoords.length;
      cLng = sumLng / editingCoords.length;
    } else {
      const currentCenter = map ? map.getCenter() : null;
      const baseCoords =
        currentCenter
          ? [currentCenter.lat, currentCenter.lng]
          : properties?.find((p) => Number(p.id) === Number(selectedProperty))?.coordinates ||
            selectedPropertyCoords;
      cLat = baseCoords[0];
      cLng = baseCoords[1];
    }

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
    return newCoords;
  };

  // Handle saving unified lot (both new and existing lots)
  const handleSaveUnifiedLot = async () => {
    if (!editingLot || editingCoords.length < 3) {
      showToast("Please ensure the lot has at least 3 corner points.", "warning");
      return;
    }

    setIsSavingCoords(true);
    try {
      if (editingLot.isNew) {
        const lotNum = (quickLotNumber || editingLot.lot_number || getNextSuggestedLotNumber()).trim();
        const area = parseFloat(quickAreaSqm || editingLot.area_sqm) || 100;
        const status = quickStatus || editingLot.status || "Available";
        const propId = parseInt(selectedProperty || editingLot.property_id);

        if (!lotNum) {
          showToast("Please enter a lot identifier or number.", "warning");
          setIsSavingCoords(false);
          return;
        }

        // 1. Create lot record in backend
        const response = await axios.post(
          `${API_BASE_URL}/api/lots`,
          {
            property_id: propId,
            lot_number: lotNum,
            area_sqm: area,
            status: status,
          },
          { withCredentials: true, ...getAuthConfig() }
        );

        const newLotId = response.data.lot_id;

        // 2. Save coordinates for the created lot
        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

        showToast(`Lot ${lotNum} created and positioned successfully!`, "success");
      } else {
        // Existing lot update coordinates
        await axios.put(
          `${API_BASE_URL}/api/lots/${editingLot.lot_id}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

        // Update details (lot_number, area) if available
        const currentLotNum = (quickLotNumber || editingLot.lot_number || "").trim();
        const currentArea = parseFloat(quickAreaSqm || editingLot.area_sqm || targetAreaSqm) || 100;
        if (currentLotNum) {
          try {
            await axios.put(
              `${API_BASE_URL}/api/lots/${editingLot.lot_id}/details`,
              {
                lot_number: currentLotNum,
                area_sqm: currentArea,
              },
              getAuthConfig()
            );
          } catch (e) {
            console.warn("Could not update lot details:", e);
          }
        }

        // Update status if available
        const currentStatus = quickStatus || editingLot.status;
        if (currentStatus) {
          try {
            await axios.put(
              `${API_BASE_URL}/api/lots/${editingLot.lot_id}/status`,
              { status: currentStatus },
              getAuthConfig()
            );
          } catch (e) {
            console.warn("Could not update lot status:", e);
          }
        }

        showToast("Coordinates updated successfully!", "success");
      }

      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}

      await handleLotUpdated();
      setEditingLot(null);
      setEditingCoords([]);
    } catch (err) {
      console.error("Error saving lot:", err);
      showToast(err.response?.data?.error || err.message || "Failed to save lot", "error");
    } finally {
      setIsSavingCoords(false);
    }
  };

  // Handle saving coordinates and immediately starting next adjacent lot
  const handleSaveUnifiedAndNext = async () => {
    if (!editingLot || editingCoords.length < 3) {
      showToast("Please ensure the lot has at least 3 corner points.", "warning");
      return;
    }

    setIsSavingCoords(true);
    try {
      const lotNum = (quickLotNumber || editingLot.lot_number || getNextSuggestedLotNumber()).trim();
      const area = parseFloat(quickAreaSqm || editingLot.area_sqm) || 100;
      const status = quickStatus || editingLot.status || "Available";
      const propId = parseInt(selectedProperty || editingLot.property_id);

      if (!lotNum) {
        showToast("Please enter a lot identifier or number.", "warning");
        setIsSavingCoords(false);
        return;
      }

      // 1. Save current lot to database
      let currentId = editingLot.lot_id;
      if (editingLot.isNew) {
        const response = await axios.post(
          `${API_BASE_URL}/api/lots`,
          {
            property_id: propId,
            lot_number: lotNum,
            area_sqm: area,
            status: status,
          },
          { withCredentials: true, ...getAuthConfig() }
        );
        currentId = response.data.lot_id;
      }

      await axios.put(
        `${API_BASE_URL}/api/lots/${currentId}/coordinates`,
        { coordinates: editingCoords },
        getAuthConfig()
      );

      // Refresh map lots in background
      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      await handleLotUpdated();

      // 2. Prepare next adjacent lot
      const nextNum = autoIncrementLotNumber(lotNum);
      const nextCoords = offsetPolygonAdjacent(editingCoords);

      setQuickLotNumber(nextNum);
      setQuickAreaSqm(area);
      setQuickStatus("Available");
      setEditingCoords(nextCoords.map((c) => [...c]));
      dragCoordsRef.current = nextCoords.map((c) => [...c]);

      setEditingLot({
        isNew: true,
        lot_number: nextNum,
        area_sqm: area,
        status: "Available",
        property_id: propId,
      });
    } catch (err) {
      console.error("Error in Save & Next:", err);
      showToast(err.response?.data?.error || err.message || "Failed to save and add next lot", "error");
    } finally {
      setIsSavingCoords(false);
    }
  };

  // Handle duplicating / cloning a lot with auto-incremented identifier & adjacent offset
  const handleDuplicateLot = (lotToDuplicate) => {
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
      showToast("Please select a lot to duplicate.", "warning");
      return;
    }

    const propId = sourceLot.property_id || selectedProperty;
    const nextLotNumber = autoIncrementLotNumber(sourceLot.lot_number || "Lot 1");
    const targetArea = sourceLot.area_sqm || 100;

    setDuplicateModalData({
      sourceLot,
      propId,
      targetArea,
      lotName: nextLotNumber,
      isSubmitting: false,
    });
  };

  const handleConfirmDuplicateLot = async () => {
    if (!duplicateModalData || duplicateModalData.isSubmitting) return;
    const { sourceLot, propId, targetArea, lotName } = duplicateModalData;
    const finalLotName = (lotName || "").trim();
    if (!finalLotName) {
      showToast("Please enter an identifier for the new lot.", "warning");
      return;
    }

    setDuplicateModalData((prev) => ({ ...prev, isSubmitting: true }));

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
        getAuthConfig()
      );

      const newLotId = createRes.data.lot_id;

      // 4. Save adjacent offset coordinates for the new lot
      if (newCoords && Array.isArray(newCoords) && newCoords.length >= 3) {
        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: newCoords },
          getAuthConfig()
        );
      }

      // 5. Invalidate caches and refresh map data
      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      await handleLotUpdated();

      // 6. Close drawer and switch visual coordinate editor to the new lot
      setIsOffcanvasOpen(false);
      setDuplicateModalData(null);
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

      showToast(`Successfully created ${finalLotName}! You can now adjust its corners.`, "success");
    } catch (err) {
      console.error("Error duplicating lot:", err);
      showToast(err.response?.data?.error || err.message || "Failed to duplicate lot", "error");
      setDuplicateModalData((prev) => (prev ? { ...prev, isSubmitting: false } : null));
    }
  };

  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      ("ontouchstart" in window && window.innerWidth < 1100));

  // Event handlers read the committed selection without rebuilding every lot
  // when a property switch or sidebar update renders the map page.
  const lotDetailsContext = useRef({ properties, selectedProperty });
  useLayoutEffect(() => {
    lotDetailsContext.current = { properties, selectedProperty };
  }, [properties, selectedProperty]);
  const showLotTooltips = currentZoom >= 19;
  const shiftedPropertyId = isBulkShifting ? selectedProperty : null;
  const renderLot = useCallback((lot, showHover, hideHover, renderer) => {
    // Skip rendering original polygon if it's currently being edited visually
    if (editingLot && Number(lot.lot_id) === Number(editingLot.lot_id)) {
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
      isBulkShifting && Number(lot.property_id) === Number(shiftedPropertyId)
        ? lot.coordinates.map(([lat, lng]) => [
            lat + bulkShiftOffset.lat,
            lng + bulkShiftOffset.lng,
          ])
        : lot.coordinates;

    const isShifted = isBulkShifting && Number(lot.property_id) === Number(shiftedPropertyId);
    const centerLat = isShifted ? (lot._centerLat ?? 0) + bulkShiftOffset.lat : (lot._centerLat ?? 0);
    const centerLng = isShifted ? (lot._centerLng ?? 0) + bulkShiftOffset.lng : (lot._centerLng ?? 0);
    const statusColor = lot._statusColor;

    const openFullLotDetails = async () => {
      const matchingProp = lotDetailsContext.current.properties.find(
        (p) => Number(p.id) === Number(lot.property_id || lotDetailsContext.current.selectedProperty)
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
          getAuthConfig()
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
      <React.Fragment key={`lot-node-${lot.lot_id}`}>
        <LotPlanPolygon
          key={`poly-${lot.lot_id}`}
          renderer={renderer}
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
            mouseover: () => showHover(lot, [centerLat, centerLng]),
            mouseout: () => hideHover(lot),
          }}
        />

        {!isBulkShifting && (
          <LotPlanPin
            key={`pin-${lot.lot_id}`}
            center={[centerLat, centerLng]}
            color={statusColor}
            eventHandlers={{
              click: handleLotClick,
              mouseover: () => showHover(lot, [centerLat, centerLng]),
              mouseout: () => hideHover(lot),
            }}
          />
        )}
      </React.Fragment>
    );

  }, [
    isTouchDevice,
    editingLot, isBulkShifting, shiftedPropertyId, bulkShiftOffset, map,
  ]);

  const overviewBeacons = useMemo(() => properties.map((property) => {
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
        }), [properties]);


  return {
    mapData,
    setMapData,
    map,
    setMap,
    currentZoom,
    setCurrentZoom,
    mapWrapperRef,
    mapLayer,
    setMapLayer,
    selectedLot,
    setSelectedLot,
    activePopupLot,
    setActivePopupLot,
    isOffcanvasOpen,
    setIsOffcanvasOpen,
    selectedProperty,
    setSelectedProperty,
    triggerArrivalPulse,
    editingLot,
    setEditingLot,
    editingCoords,
    setEditingCoords,
    isSavingCoords,
    setIsSavingCoords,
    enableSnapping,
    setEnableSnapping,
    isDraggingPolygon,
    setIsDraggingPolygon,
    polygonDragRef,
    editingPolygonRef,
    dragCoordsRef,
    cornerMarkersRef,
    centerMoveMarkerRef,
    liveAreaSqm,
    targetAreaSqm,
    overlayImage,
    setOverlayImage,
    overlayBounds,
    setOverlayBounds,
    overlayOpacity,
    setOverlayOpacity,
    overlayVisible,
    setOverlayVisible,
    isEditingOverlay,
    setIsEditingOverlay,
    showOverlayPanel,
    setShowOverlayPanel,
    overlayRotation,
    setOverlayRotation,
    overlayMultiply,
    setOverlayMultiply,
    overlayLineColor,
    setOverlayLineColor,
    overlayLineBoldness,
    setOverlayLineBoldness,
    isCropModalOpen,
    setIsCropModalOpen,
    duplicateModalData,
    setDuplicateModalData,
    originalUploadedImageRef,
    rawOverlayRef,
    transparentOverlayRef,
    overlayRef,
    overlayFrameRef,
    overlayCornerMarkersRef,
    overlayMoveStartRef,
    overlayCornerDragRef,
    unrotatedSpanRef,
    overlayOperationRef,
    activeOverlayPropertyRef,
    overlayBlobCacheRef,
    activeOverlayUrlRef,
    isPreparingOverlay,
    setIsPreparingOverlay,
    reviewViewportRef,
    lotImport,
    handleOpenReview,
    showAnnotationPanel,
    setShowAnnotationPanel,
    isEditingAnnotations,
    setIsEditingAnnotations,
    activeAnnotationId,
    setActiveAnnotationId,
    annotations,
    setAnnotations,
    isSavingAnnotations,
    setIsSavingAnnotations,
    automaticRoadAnnotations,
    quickLotNumber,
    setQuickLotNumber,
    quickAreaSqm,
    setQuickAreaSqm,
    quickStatus,
    setQuickStatus,
    floatingPos,
    setFloatingPos,
    isDraggingFloatingRef,
    dragOffsetRef,
    getNextSuggestedLotNumber,
    handleOpenQuickAdd,
    allPropertiesAnnotations,
    handleAddAnnotation,
    handleUpdateAnnotation,
    handleUpdateAllAnnotations,
    handleDeleteAnnotation,
    handleDeleteAllAnnotations,
    createRoadLabelIcon,
    handleFloatingMouseDown,
    isBulkShifting,
    setIsBulkShifting,
    bulkShiftOffset,
    setBulkShiftOffset,
    pendingBulkShift,
    setPendingBulkShift,
    isBulkShiftSubmitting,
    setIsBulkShiftSubmitting,
    bulkShiftError,
    setBulkShiftError,
    bulkShiftSuccessMessage,
    setBulkShiftSuccessMessage,
    handleVertexDrag,
    handleVertexDragEnd,
    handleRemoveVertex,
    handleAddVertexAtIndex,
    midpointHandles,
    createMidpointIcon,
    getPolygonCentroid,
    createPolygonCenterMoveIcon,
    createHandleIcon,
    createOverlayCornerIcon,
    getRotatedBlueprintCorners,
    handleOverlayCornerDragStart,
    handleOverlayCornerDrag,
    handleOverlayCornerDragEnd,
    handleRotationChange,
    handleLineColorChange,
    handleLineBoldnessChange,
    handleApplyCrop,
    handleResetOverlay,
    handleImageUpload,
    handleScaleOverlay,
    handleOpenBulkShiftConfirm,
    handleCloseBulkShiftConfirm,
    confirmBulkShift,
    handleSaveBulkShift,
    createOverlayCenterIcon,
    properties,
    activePropertyIds,
    filteredLots,
    selectedPropertyCoords,
    handleLotUpdated,
    handleLiveLotUpdate,
    persistAnnotations,
    handleSaveAnnotations,
    handleToggleOverlayEdit,
    startPolygonDrag,
    handleScaleEditingCoords,
    handleResetToSquareSize,
    handleSaveUnifiedLot,
    handleSaveUnifiedAndNext,
    handleDuplicateLot,
    handleConfirmDuplicateLot,
    isTouchDevice,
    lotDetailsContext,
    showLotTooltips,
    shiftedPropertyId,
    renderLot,
    overviewBeacons,
    getAuthConfig,
    STATUS_COLORS,
    isNonSaleableLot,
    getStatusColor,
    saveBlueprintOverlay,
    loadBlueprintOverlay,
    removeBlueprintOverlay,
    restoreLotImport,
    createTransparentPaperImage,
  };
};

export default useAdminViewMap;
