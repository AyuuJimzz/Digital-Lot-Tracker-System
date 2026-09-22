import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

import {
  MapContainer,
  Pane,
  Polygon,
  Popup,
  useMap,
  Marker,
  ImageOverlay,
} from "react-leaflet";
import axios from "axios";
import L from "leaflet";
import LotOffcanvas from "../../components/admin/LotOffcanvas";
import { ImageOverlayControl } from "../../components/admin/ImageOverlayControl";
import { BlueprintCropModal } from "../../components/admin/BlueprintCropModal";
import { LotImportReviewModal } from "../../components/admin/LotImportReviewModal";
import { useBlueprintLotImport } from "../../hooks/useBlueprintLotImport";
import { usePropertyMapNavigation, waitForPropertyFlight } from "../../hooks/usePropertyMapNavigation";
import { LotPlanPin } from "../../components/admin/LotPlanPin";
import { LotPlanPolygon } from "../../components/admin/LotPlanPolygon";
import { ViewportLotLayer } from "../../components/admin/ViewportLotLayer";
import { getLotBounds } from "../../utils/lotViewport";
import { useSmoothWheelZoom } from "../../hooks/useSmoothWheelZoom";
import { projectBlueprintRoadLabel, reframeBlueprintCrop } from "../../utils/blueprintLotProjection";
import { mergeGeneratedRoadAnnotations } from "../../utils/pdfLotImport/roadLabels";
import { MapAnnotationControl } from "../../components/admin/MapAnnotationControl";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import { MapLayerControls, ActiveMapTileLayer, MAP_LAYERS } from "../../components/admin/MapLayerControls";
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
import { Magnet, Copy, Ruler, Plus, X, GripHorizontal, AlertTriangle, CheckCircle2 } from "lucide-react";
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

const getAuthConfig = () => {
  const token = localStorage.getItem("authToken");
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

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
// ── Optimization: O(1) status → color lookup ──────────────────────────────
const STATUS_COLORS = {
  Available: "#22c55e",
  Pending: "#eab308",
  Sold: "#ef4444",
  NonSaleable: "#64748b",
};

const isNonSaleableLot = (lotNumber = "", areaSqm = 0) => {
  const num = String(lotNumber || "").toLowerCase().trim();
  return (
    num.includes("park") ||
    num.includes("playground") ||
    num.includes("facility") ||
    num.includes("clubhouse") ||
    num.includes("excluded") ||
    num.includes("open space") ||
    num.includes("easement") ||
    num.includes("community") ||
    num.includes("p & pg") ||
    num.includes("amenity") ||
    num.includes("common") ||
    num.includes("non-saleable") ||
    num.includes("non saleable")
  );
};

const getStatusColor = (status, lotNumber = "", areaSqm = 0) => {
  if (isNonSaleableLot(lotNumber, areaSqm)) {
    return STATUS_COLORS.NonSaleable;
  }
  return STATUS_COLORS[status] || "#94a3b8";
};

function MapController({
  center,
  onLotUpdated,
  selectedProperty,
  setSelectedProperty,
  triggerArrivalPulse,
  setMap,
  setCurrentZoom,
  mapLayer,
  properties,
}) {
  const map = useMap();

  useEffect(() => {
    if (setMap) setMap(map);
    if (setCurrentZoom) setCurrentZoom(map.getZoom());

    // Real-time geo-scale & street-level class tracking on DOM container
    const container = map.getContainer();
    const updateZoomClasses = (z) => {
      const scale = Math.max(0.45, Math.pow(1.4, z - 19));
      container.style.setProperty("--road-label-scale", scale);
      container.style.setProperty("--pdf-road-label-scale", Math.pow(2, z - 20));

      // Show road text labels at comfortable subdivision view (zoom >= 18.2)
      if (z >= 18.2) {
        container.classList.add("map-zoom-street-level");
      } else {
        container.classList.remove("map-zoom-street-level");
      }

      // Real-time overview beacon and tooltip decluttering (instant on threshold, no debounce delay)
      if (z < 18) {
        container.classList.add("map-view-zoomed-out");
        container.classList.remove("map-view-zoomed-in");
      } else {
        container.classList.add("map-view-zoomed-in");
        container.classList.remove("map-view-zoomed-out");
      }
    };
    updateZoomClasses(map.getZoom());

    const handleZoomAnim = (e) => {
      // Property flights already hide road labels. Avoid per-frame style writes
      // for every mapped lot while Leaflet is animating the camera.
      if (container.classList.contains("map-is-flying")) return;
      updateZoomClasses(e.zoom);
    };

    const handleZoom = () => {
      if (container.classList.contains("map-is-flying")) return;
      updateZoomClasses(map.getZoom());
    };

    // Only update React state when zoom crosses a threshold that changes rendered output.
    // Thresholds: 18 (zoomed-out class, beacon/pin visibility), 19 (tooltip visibility, annotations).
    // All other zoom changes are handled imperatively by updateZoomClasses — no re-render needed.
    let debounceTimer;
    const ZOOM_THRESHOLDS = [18, 18.2, 19, 19.5];
    const handleZoomEnd = () => {
      clearTimeout(debounceTimer);
      const z = map.getZoom();
      updateZoomClasses(z);
      debounceTimer = setTimeout(() => {
        if (!setCurrentZoom) return;
        setCurrentZoom((prev) => {
          // Only re-render if the new zoom crossed a threshold boundary from the previous value
          const crossed = ZOOM_THRESHOLDS.some(
            (t) => (prev < t) !== (z < t)
          );
          return crossed ? z : prev;
        });
      }, 300);
    };

    // Auto-close any lingering hover tooltips when map begins moving/dragging/zooming
    const handleDismissTooltips = () => {
      // A new gesture cancels the previous gesture's delayed React update.
      clearTimeout(debounceTimer);
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

  usePropertyMapNavigation(map, {
    selectedProperty,
    setSelectedProperty,
    properties,
    mapLayer,
    triggerArrivalPulse,
  });
  useSmoothWheelZoom(map);

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

// Helper: converts Blob/URL to permanent base64 Data URL for persistent IndexedDB storage
const toDataURL = (urlOrBlob) => {
  return new Promise((resolve) => {
    if (!urlOrBlob) return resolve(urlOrBlob);
    if (typeof urlOrBlob === "string" && urlOrBlob.startsWith("data:")) {
      return resolve(urlOrBlob);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = c.toDataURL("image/png");
        c.width = 0;
        c.height = 0;
        resolve(dataUrl);
      } catch (e) {
        c.width = 0;
        c.height = 0;
        resolve(urlOrBlob);
      }
    };
    img.onerror = () => resolve(urlOrBlob);
    img.src = urlOrBlob;
  });
};

const generateSourceRevision = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `rev_${crypto.randomUUID()}`
    : `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Helper: converts paper/transparent background into alpha transparency & CAD lines into chosen high-contrast color, rotated on Canvas, returning a Blob
const createTransparentPaperBlob = (imageUrl, lineColor = "lime", rotationDeg = 0, lineBoldness = "fine", multiply = true) => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = async () => {
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
        if (multiply) {
          const imgData = ctx.getImageData(0, 0, newW, newH);
          const data = imgData.data;

          // Color selection (default to Lime)
          let targetR = 52, targetG = 211, targetB = 153;
          if (lineColor === "amber" || lineColor === "gold" || lineColor === "yellow") {
            targetR = 251; targetG = 191; targetB = 36;
          } else if (lineColor === "cyan" || lineColor === "blue") {
            targetR = 6; targetG = 182; targetB = 212;
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

          // Large saved blueprints can contain millions of pixels. Give camera
          // rendering and input a turn instead of processing them in one task.
          let sliceStarted = performance.now();
          for (let i = 0; i < data.length; i += 4) {
            if (i % 65536 === 0 && performance.now() - sliceStarted >= 4) {
              await new Promise((resume) => setTimeout(resume, 0));
              sliceStarted = performance.now();
            }
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
              if (performance.now() - sliceStarted >= 4) {
                await new Promise((resume) => setTimeout(resume, 0));
                sliceStarted = performance.now();
              }
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
        }
      } catch (e) {}

      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob || null);
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

// Compatibility wrapper preserving the existing string URL return contract for all callers
const createTransparentPaperImage = async (imageUrl, lineColor = "lime", rotationDeg = 0, lineBoldness = "fine", multiply = true) => {
  const blob = await createTransparentPaperBlob(imageUrl, lineColor, rotationDeg, lineBoldness, multiply);
  return blob ? URL.createObjectURL(blob) : imageUrl;
};

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
  const [overlayLineColor, setOverlayLineColor] = useState("lime"); // High-contrast CAD color (default to lime)
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
  const overlayOperationRef = useRef(0);
  const activeOverlayPropertyRef = useRef(selectedProperty);
  activeOverlayPropertyRef.current = selectedProperty;
  const overlayBlobCacheRef = useRef(new Map());
  const activeOverlayUrlRef = useRef(null);
  const [isPreparingOverlay, setIsPreparingOverlay] = useState(false);
  const lotImport = useBlueprintLotImport({
    propertyId: selectedProperty, map, bounds: overlayBounds, rotation: overlayRotation,
    isAligning: isEditingOverlay || isPreparingOverlay,
  });
  const { restore: restoreLotImport, applyCrop: applyLotImportCrop } = lotImport;

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
      const isSelected = Number(p.property_id) === Number(selectedProperty);
      if (isSelected && isEditingOverlay && !showAnnotationPanel && automaticRoadAnnotations.length) {
        result.push(...mergeGeneratedRoadAnnotations(annotations, automaticRoadAnnotations)
          .map((a) => ({ ...a, property_id: p.property_id })));
        return;
      }
      if (isSelected) {
        result.push(...annotations.map((a) => ({ ...a, property_id: p.property_id })));
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
  }, [mapData, showAnnotationPanel, selectedProperty, annotations, automaticRoadAnnotations, isEditingOverlay]);

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
        { withCredentials: true, ...getAuthConfig() }
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
      if (notify) alert("✅ Road & map labels saved successfully to database!");
      await handleLotUpdated();
      return true;
    } catch (err) {
      console.error("Error saving map annotations:", err);
      alert(err.response?.data?.error || "Blueprint aligned, but the road labels could not be saved. Open Road Labels and try Save again.");
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
      const { lot_id, lot_number, property_id, coordinates, area_sqm } = event.detail;
      setEditingLot({ lot_id, lot_number, property_id, area_sqm });

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
  }, [map, properties, selectedPropertyCoords, overlayRotation, mapData]);

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
                detail: { propertyId: property.id, coordinates: property.coordinates, straight: true },
              })
            );
          },
        }}
      />
    );
        }), [properties]);

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div
      ref={mapWrapperRef}
      className={`w-full h-full relative ${showAnnotationPanel && isEditingAnnotations ? "map-editing-labels-active" : ""}`}
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={properties && properties.length > 0 ? selectedPropertyCoords : [10.90, 122.60]}
        zoom={properties && properties.length > 0 ? 19 : 9}
        preferCanvas={true}
        zoomDelta={0.25}
        zoomSnap={0}
        wheelPxPerZoomLevel={220}
        wheelDebounceTime={20}
        maxZoom={28}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        fadeAnimation={false}
        markerZoomAnimation={true}
        touchZoom={true}
        tap={false}
        bounceAtZoomLimits={false}
        inertia={true}
        inertiaDeceleration={6000}
        inertiaMaxSpeed={700}
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
            setMapLayer(newLayer);
            localStorage.setItem("preferredMapLayer", newLayer);
          }}
          mapContainerRef={mapWrapperRef}
        />
        <MapController
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
          triggerArrivalPulse={triggerArrivalPulse}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
          mapLayer={mapLayer}
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
        {overviewBeacons}

        {lotImport.preview && !isEditingOverlay && !isPreparingOverlay && (() => {
          const candidateColor =
            overlayLineColor === "cyan" ? "#06b6d4"
            : overlayLineColor === "white" ? "#ffffff"
            : overlayLineColor === "lime" ? "#34d399"
            : overlayLineColor === "amber" || overlayLineColor === "yellow" ? "#fbbf24"
            : overlayLineColor === "black" ? "#0f172a"
            : "#06b6d4";

          return lotImport.projected.map((candidate) => (
            <Polygon
              key={candidate.id}
              positions={candidate.coordinates}
              interactive={false}
              pathOptions={{
                color: candidate.selected ? "#10b981" : candidateColor,
                weight: 1.5,
                fillColor: candidate.selected ? "#10b981" : candidateColor,
                fillOpacity: candidate.selected ? 0.2 : 0.05,
              }}
            />
          ));
        })()}
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



        <Pane name="lot-plan" className="lot-plan-pane" style={{ zIndex: 410 }}>
          <ViewportLotLayer lots={filteredLots} renderLot={renderLot}
            showTooltips={showLotTooltips && !isBulkShifting} isTouchDevice={isTouchDevice}
            offsetPropertyId={shiftedPropertyId} offset={bulkShiftOffset} />
        </Pane>

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

        {/* Road and map labels match the generated blueprint and stay visible across zoom levels */}
        {allPropertiesAnnotations.map((item) => {
            const isThisPropActive =
              Number(item.property_id) === Number(selectedProperty);
            const isInteractive =
              isEditingAnnotations && showAnnotationPanel && isThisPropActive && !isBulkShifting;
            const itemLat =
              isBulkShifting && isThisPropActive
                ? item.lat + bulkShiftOffset.lat
                : item.lat;
            const itemLng =
              isBulkShifting && isThisPropActive
                ? item.lng + bulkShiftOffset.lng
                : item.lng;
            return (
              <Marker
                key={`${item.property_id || "p"}-${item.id}`}
                position={[itemLat, itemLng]}
                draggable={isInteractive}
                icon={createRoadLabelIcon(
                  item,
                  isInteractive,
                  activeAnnotationId === item.id && isThisPropActive
                )}
                eventHandlers={{
                  click: () => {
                    if (isBulkShifting) return;
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
                setPendingBulkShift(false);
                setBulkShiftError("");
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── In-App Bulk Shift Confirmation Modal ── */}
      {pendingBulkShift && typeof document !== "undefined" && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-shift-modal-title"
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="bulk-shift-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                    Confirm Bulk Lot Shift?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Bulk coordinate movement confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseBulkShiftConfirm}
                disabled={isBulkShiftSubmitting}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shift Operation Details */}
            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-gray-100 dark:border-slate-700/60 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Property:
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[240px]">
                  {properties.find((p) => Number(p.id) === Number(selectedProperty))?.name || "Selected Property"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Affected Lots:
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {mapData?.lots ? mapData.lots.filter((l) => Number(l.property_id) === Number(selectedProperty)).length : 0} lots
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Coordinate Offset:
                </span>
                <span className="font-mono text-xs text-gray-600 dark:text-slate-300">
                  ΔLat: {bulkShiftOffset.lat.toFixed(6)}, ΔLng: {bulkShiftOffset.lng.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 mb-4 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Warning
              </p>
              <p>
                This operation will update multiple lot coordinates/positions at once.
              </p>
              <p className="mt-1 font-semibold text-amber-900 dark:text-amber-100">
                This action should only continue if the admin confirms the changes.
              </p>
            </div>

            {/* Error Message inside Modal */}
            {bulkShiftError && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-xs mb-4">
                <span className="font-bold">Error: </span>
                {bulkShiftError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseBulkShiftConfirm}
                disabled={isBulkShiftSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkShift}
                disabled={isBulkShiftSubmitting}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
                  isBulkShiftSubmitting
                    ? "bg-emerald-400 dark:bg-emerald-600/70 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                }`}
              >
                {isBulkShiftSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Confirm Shift</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Success Banner */}
      {bulkShiftSuccessMessage && typeof document !== "undefined" && ReactDOM.createPortal(
        <div className="fixed top-6 right-6 z-[99999] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl animate-in fade-in duration-150 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{bulkShiftSuccessMessage}</span>
        </div>,
        document.body
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
        onLiveLotUpdate={handleLiveLotUpdate}
        allowedStatuses={["Available", "Pending", "Sold"]}
        showCoordinateEdit={true}
        onDuplicateLot={(lot) => {
          setIsOffcanvasOpen(false);
          handleDuplicateLot(lot);
        }}
        onStartCoordinateEdit={(lot) => {
          setIsOffcanvasOpen(false);
          let rawCoords = lot.coordinates;
          if (typeof rawCoords === "string") {
            try {
              rawCoords = JSON.parse(rawCoords);
            } catch (e) {
              rawCoords = null;
            }
          }
          if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length === 0) {
            const found = mapData?.lots?.find((l) => Number(l.lot_id) === Number(lot.lot_id));
            if (found?.coordinates) {
              rawCoords =
                typeof found.coordinates === "string"
                  ? JSON.parse(found.coordinates)
                  : found.coordinates;
            }
          }
          window.dispatchEvent(
            new CustomEvent("startVisualEdit", {
              detail: {
                lot_id: lot.lot_id,
                lot_number: lot.lot_number,
                property_id: lot.property_id,
                coordinates: rawCoords,
                area_sqm: lot.area_sqm,
              },
            })
          );
        }}
      />

      {/* ── Site Plan Overlay Control Panel ──────────────────────────── */}
      {showOverlayPanel && (
        <ImageOverlayControl
          key={selectedProperty}
          importCount={lotImport.candidates.length}
          roadLabelCount={lotImport.draft?.roadLabels?.length || 0}
          hasImportSource={Boolean(lotImport.draft)}
          importWarnings={lotImport.draft?.warnings || []}
          importMessage={lotImport.message}
          importError={lotImport.error}
          onReviewImport={lotImport.openReview}
          previewImport={lotImport.preview}
          onToggleImportPreview={lotImport.togglePreview}
          isPreparingOverlay={isPreparingOverlay}
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
            const operation = ++overlayOperationRef.current;
            setIsPreparingOverlay(true);
            const image = await createTransparentPaperImage(rawOverlayRef.current, overlayLineColor, overlayRotation, overlayLineBoldness, next);
            if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(image); return; }
            setOverlayMultiply(next);
            setOverlayImage(image);
            transparentOverlayRef.current = image;
            setIsPreparingOverlay(false);
            await saveBlueprintOverlay(selectedProperty, { multiply: next });
          }}
          onRotationChange={handleRotationChange}
          onRotate90={(delta) => handleRotationChange((overlayRotation + delta) % 360)}
          onReset={handleResetOverlay}
          onScaleOverlay={handleScaleOverlay}
          onOpenCrop={() => setIsCropModalOpen(true)}
          onToggleVisible={() => setOverlayVisible((prev) => !prev)}
          onToggleEdit={handleToggleOverlayEdit}
          onToggleBulkShift={() => {
            setIsBulkShifting((prev) => !prev);
            setBulkShiftOffset({ lat: 0, lng: 0 });
          }}
          onRemove={async () => {
            ++overlayOperationRef.current;
            restoreLotImport(null);
            setIsPreparingOverlay(false);
            if (activeOverlayUrlRef.current && activeOverlayUrlRef.current.startsWith("blob:")) {
              try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
              activeOverlayUrlRef.current = null;
            } else if (overlayImage && overlayImage.startsWith("blob:")) {
              try { URL.revokeObjectURL(overlayImage); } catch (e) {}
            }
            if (selectedProperty) {
              overlayBlobCacheRef.current.delete(selectedProperty);
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

      {lotImport.isReviewOpen && (
        <LotImportReviewModal
          candidates={lotImport.candidates}
          onCandidatesChange={lotImport.changeCandidates}
          onClose={lotImport.closeReview}
          onImport={() => lotImport.importLots(handleLotUpdated)}
          isImporting={lotImport.isImporting}
          error={lotImport.error}
          sourceName={`${lotImport.draft.sourceName} · Page ${lotImport.draft.pageNumber}`}
          existingLotNumbers={(mapData?.lots || []).filter((lot) => Number(lot.property_id) === Number(selectedProperty)).map((lot) => lot.lot_number)}
          imageUrl={originalUploadedImageRef.current}
          pageWidth={lotImport.draft.pageWidth}
          pageHeight={lotImport.draft.pageHeight}
          warnings={lotImport.warnings}
          autoFixDuplicates={true}
          autoSelectAll={true}
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
          annotations={annotations.filter((item) => !item.deleted)}
          activeAnnotationId={activeAnnotationId}
          onSelectAnnotation={(id) => setActiveAnnotationId(id)}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onUpdateAllAnnotations={handleUpdateAllAnnotations}
          onDeleteAnnotation={handleDeleteAnnotation}
          onDeleteAllAnnotations={handleDeleteAllAnnotations}
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
