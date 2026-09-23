import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import axios from "axios";
import L from "leaflet";
import { API_BASE_URL } from "../../../../config/api";
import { showToast } from "../../../../components/GlobalToast";
import { DEFAULT_COORDINATES_MAP } from "../../../../utils/geocoding";
import {
  calculateGeodesicArea,
  autoIncrementLotNumber,
  findSnapVertex,
  offsetPolygonAdjacent,
} from "../../../../utils/geoUtils";
import { getAuthConfig } from "../utils/mapConstants";

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
  // States for visual coordinate editing
  const [editingLot, setEditingLot] = useState(null);
  const [editingCoords, setEditingCoords] = useState([]);
  const [isSavingCoords, setIsSavingCoords] = useState(false);

  // Snapping Magnet States
  const [enableSnapping, setEnableSnapping] = useState(true);

  // State and Ref for dragging the entire polygon
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const polygonDragRef = useRef(null);

  // Refs for smooth vertex dragging
  const editingPolygonRef = useRef(null);
  const dragCoordsRef = useRef([]);
  const cornerMarkersRef = useRef([]);
  const centerMoveMarkerRef = useRef(null);

  // Draggable Floating Unified Lot States
  const [quickLotNumber, setQuickLotNumber] = useState("");
  const [quickAreaSqm, setQuickAreaSqm] = useState(100);
  const [quickStatus, setQuickStatus] = useState("Available");
  const [floatingPos, setFloatingPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 190)) : 380,
    y: 110,
  }));
  const isDraggingFloatingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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

  useEffect(() => {
    const handleOpenQuickAddEvent = () => handleOpenQuickAdd();
    window.addEventListener("openQuickAddLot", handleOpenQuickAddEvent);
    return () => window.removeEventListener("openQuickAddLot", handleOpenQuickAddEvent);
  }, [handleOpenQuickAdd]);

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

  const handleVertexDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();

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
        const sideMeters = Math.sqrt(targetArea);
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

      if (editingPolygonRef.current) {
        editingPolygonRef.current.setLatLngs(candidateCoords);
      }

      if (cornerMarkersRef.current) {
        cornerMarkersRef.current.forEach((marker, index) => {
          if (marker && candidateCoords[index]) {
            marker.setLatLng(candidateCoords[index]);
          }
        });
      }

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

        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

        showToast(`Lot ${lotNum} created and positioned successfully!`, "success");
      } else {
        await axios.put(
          `${API_BASE_URL}/api/lots/${editingLot.lot_id}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

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

      if (handleLotUpdated) await handleLotUpdated();
      setEditingLot(null);
      setEditingCoords([]);
    } catch (err) {
      console.error("Error saving lot:", err);
      showToast(err.response?.data?.error || err.message || "Failed to save lot", "error");
    } finally {
      setIsSavingCoords(false);
    }
  };

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

      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      if (handleLotUpdated) await handleLotUpdated();

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

  return {
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
    handleFloatingMouseDown,
    handleVertexDrag,
    handleVertexDragEnd,
    handleRemoveVertex,
    handleAddVertexAtIndex,
    midpointHandles,
    createMidpointIcon,
    getPolygonCentroid,
    createPolygonCenterMoveIcon,
    createHandleIcon,
    startPolygonDrag,
    handleScaleEditingCoords,
    handleResetToSquareSize,
    handleSaveUnifiedLot,
    handleSaveUnifiedAndNext,
  };
}

export default useLotEditorState;
