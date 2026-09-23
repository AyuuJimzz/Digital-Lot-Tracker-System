import { useState, useRef, useMemo, useCallback } from "react";
import { findSnapVertex } from "../../../../utils/geoUtils";
import { showToast } from "../../../../components/GlobalToast";
import { getPolygonCentroid } from "../utils/lotEditorIcons";

export const useLotDragEngine = ({
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
}) => {
  // State and Ref for dragging the entire polygon
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const polygonDragRef = useRef(null);

  // Draggable Floating Unified Lot States
  const [floatingPos, setFloatingPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(340, Math.floor(window.innerWidth / 2 - 190)) : 380,
    y: 110,
  }));
  const isDraggingFloatingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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
  }, [map, editingCoords, enableSnapping, mapData, editingLot, dragCoordsRef, editingPolygonRef, cornerMarkersRef, centerMoveMarkerRef, setEditingCoords]);

  return {
    isDraggingPolygon,
    setIsDraggingPolygon,
    polygonDragRef,
    floatingPos,
    setFloatingPos,
    isDraggingFloatingRef,
    dragOffsetRef,
    handleFloatingMouseDown,
    handleVertexDrag,
    handleVertexDragEnd,
    handleRemoveVertex,
    handleAddVertexAtIndex,
    midpointHandles,
    startPolygonDrag,
  };
};

export default useLotDragEngine;
