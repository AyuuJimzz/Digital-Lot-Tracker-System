import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { calculateGeodesicArea } from "../../../../utils/geoUtils";
import { getPropertyFallbackCoordinates } from "../../../../utils/geocoding";
import {
  getPolygonCentroid,
  createMidpointIcon,
  createPolygonCenterMoveIcon,
  createHandleIcon,
} from "../utils/lotEditorIcons";
import {
  generateInitialLotSquare,
  scalePolygonCoords,
  resetPolygonToSquare,
} from "../utils/lotEditorGeometry";
import useLotDragEngine from "./useLotDragEngine";
import useLotPersistence from "./useLotPersistence";

/**
 * useLotEditorState - Core orchestrator hook for lot polygon editing,
 * snapping, transformations, pointer drag interactions, and persistence.
 */
export function useLotEditorState({
  map,
  mapData,
  selectedProperty,
  overlayRotation = 0,
  properties = [],
  selectedPropertyCoords,
  handleLotUpdated,
  setSelectedProperty,
}) {
  // Visual coordinate editing states
  const [editingLot, setEditingLot] = useState(null);
  const [editingCoords, setEditingCoords] = useState([]);
  const [enableSnapping, setEnableSnapping] = useState(true);

  // High-performance direct Leaflet refs
  const editingPolygonRef = useRef(null);
  const dragCoordsRef = useRef([]);
  const cornerMarkersRef = useRef([]);
  const centerMoveMarkerRef = useRef(null);

  // Quick-Add / Floating unified lot form states
  const [quickLotNumber, setQuickLotNumber] = useState("");
  const [quickAreaSqm, setQuickAreaSqm] = useState(100);
  const [quickStatus, setQuickStatus] = useState("Available");

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

  // Drag Engine Sub-Hook
  const dragEngine = useLotDragEngine({
    map,
    mapData,
    editingLot,
    editingCoords,
    setEditingCoords,
    enableSnapping,
    dragCoordsRef,
    editingPolygonRef,
    cornerMarkersRef,
    centerMoveMarkerRef,
  });

  // Persistence & Save Sub-Hook
  const persistence = useLotPersistence({
    editingLot,
    setEditingLot,
    editingCoords,
    setEditingCoords,
    dragCoordsRef,
    quickLotNumber,
    setQuickLotNumber,
    quickAreaSqm,
    setQuickAreaSqm,
    quickStatus,
    setQuickStatus,
    selectedProperty,
    targetAreaSqm,
    getNextSuggestedLotNumber,
    handleLotUpdated,
  });

  // Quick Add initialization handler
  const handleOpenQuickAdd = useCallback(() => {
    const nextNum = getNextSuggestedLotNumber();
    const area = 100;
    setQuickLotNumber(nextNum);
    setQuickAreaSqm(area);
    setQuickStatus("Available");
    dragEngine.setFloatingPos({
      x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 190)) : 380,
      y: 110,
    });

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
        baseCoords = getPropertyFallbackCoordinates(selectedProperty, prop?.location, prop?.property_name);
      }
    }

    const initCoords = generateInitialLotSquare(baseCoords, area, overlayRotation);

    dragCoordsRef.current = initCoords.map((c) => [...c]);
    setEditingCoords(initCoords);

    setEditingLot({
      isNew: true,
      lot_number: nextNum,
      area_sqm: area,
      status: "Available",
      property_id: parseInt(selectedProperty),
    });
  }, [getNextSuggestedLotNumber, map, mapData, selectedProperty, overlayRotation, dragEngine]);

  // Subscribe to quick add event
  useEffect(() => {
    const handleOpenQuickAddEvent = () => handleOpenQuickAdd();
    window.addEventListener("openQuickAddLot", handleOpenQuickAddEvent);
    return () => window.removeEventListener("openQuickAddLot", handleOpenQuickAddEvent);
  }, [handleOpenQuickAdd]);

  // Subscribe to visual edit event
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

      if (!parsedCoords || !Array.isArray(parsedCoords) || parsedCoords.length === 0) {
        const foundLot = mapData?.lots?.find((l) => Number(l.lot_id) === Number(lot_id));
        if (foundLot?.coordinates) {
          parsedCoords =
            typeof foundLot.coordinates === "string"
              ? JSON.parse(foundLot.coordinates)
              : foundLot.coordinates;
        }
      }

      let initCoords = [];
      if (parsedCoords && Array.isArray(parsedCoords) && parsedCoords.length > 0) {
        initCoords = parsedCoords.map((c) => [...c]);
      } else {
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
            baseCoords = getPropertyFallbackCoordinates(property_id || selectedProperty, prop?.location, prop?.property_name);
          }
        }

        const targetArea = parseFloat(area_sqm) || 100;
        initCoords = generateInitialLotSquare(baseCoords, targetArea, overlayRotation);
      }

      dragCoordsRef.current = initCoords.map((c) => [...c]);
      setEditingCoords(initCoords);
    };

    window.addEventListener("startVisualEdit", handleStartVisualEdit);
    return () => {
      window.removeEventListener("startVisualEdit", handleStartVisualEdit);
    };
  }, [map, mapData, selectedProperty, overlayRotation]);

  // Scaling handler
  const handleScaleEditingCoords = (factor) => {
    const scaled = scalePolygonCoords(editingCoords, factor);
    setEditingCoords(scaled);
    dragCoordsRef.current = scaled.map((c) => [...c]);
  };

  // Reset to square handler
  const handleResetToSquareSize = (targetArea = 100) => {
    const currentCenter = map ? map.getCenter() : null;
    const fallbackCenter =
      currentCenter
        ? [currentCenter.lat, currentCenter.lng]
        : properties?.find((p) => Number(p.id) === Number(selectedProperty))?.coordinates ||
          selectedPropertyCoords;

    const newCoords = resetPolygonToSquare(editingCoords, targetArea, overlayRotation, fallbackCenter);
    setEditingCoords(newCoords);
    dragCoordsRef.current = newCoords.map((c) => [...c]);
    return newCoords;
  };

  return {
    editingLot,
    setEditingLot,
    editingCoords,
    setEditingCoords,
    isSavingCoords: persistence.isSavingCoords,
    setIsSavingCoords: persistence.setIsSavingCoords,
    enableSnapping,
    setEnableSnapping,
    isDraggingPolygon: dragEngine.isDraggingPolygon,
    setIsDraggingPolygon: dragEngine.setIsDraggingPolygon,
    polygonDragRef: dragEngine.polygonDragRef,
    editingPolygonRef,
    dragCoordsRef,
    cornerMarkersRef,
    centerMoveMarkerRef,
    liveAreaSqm,
    targetAreaSqm,
    quickLotNumber,
    setQuickLotNumber,
    quickAreaSqm,
    setQuickAreaSqm,
    quickStatus,
    setQuickStatus,
    floatingPos: dragEngine.floatingPos,
    setFloatingPos: dragEngine.setFloatingPos,
    isDraggingFloatingRef: dragEngine.isDraggingFloatingRef,
    dragOffsetRef: dragEngine.dragOffsetRef,
    getNextSuggestedLotNumber,
    handleOpenQuickAdd,
    handleFloatingMouseDown: dragEngine.handleFloatingMouseDown,
    handleVertexDrag: dragEngine.handleVertexDrag,
    handleVertexDragEnd: dragEngine.handleVertexDragEnd,
    handleRemoveVertex: dragEngine.handleRemoveVertex,
    handleAddVertexAtIndex: dragEngine.handleAddVertexAtIndex,
    midpointHandles: dragEngine.midpointHandles,
    createMidpointIcon,
    getPolygonCentroid,
    createPolygonCenterMoveIcon,
    createHandleIcon,
    startPolygonDrag: dragEngine.startPolygonDrag,
    handleScaleEditingCoords,
    handleResetToSquareSize,
    handleSaveUnifiedLot: persistence.handleSaveUnifiedLot,
    handleSaveUnifiedAndNext: persistence.handleSaveUnifiedAndNext,
  };
}

export default useLotEditorState;
