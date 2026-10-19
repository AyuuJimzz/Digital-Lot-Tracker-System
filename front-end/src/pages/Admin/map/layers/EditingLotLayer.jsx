import React from "react";
import { Pane, Polygon, Marker } from "react-leaflet";
import L from "leaflet";

// Create an explicit center move icon for grabbing and dragging the entire lot
export const createPolygonCenterMoveIcon = () => {
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
export const createHandleIcon = (index) => {
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

// Create a small '+' icon for the midpoint handles with generous hit target
export const createMidpointIcon = () => {
  return L.divIcon({
    className: "custom-midpoint-icon",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
      ">
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: #10b981;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
          pointer-events: none;
        ">+</div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Helper: Computes centroid of a polygon coordinate array
export const getPolygonCentroid = (coords) => {
  if (!coords || coords.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLng = 0;
  for (let i = 0; i < coords.length; i++) {
    sumLat += coords[i][0];
    sumLng += coords[i][1];
  }
  return [sumLat / coords.length, sumLng / coords.length];
};

export const EditingLotLayer = ({
  editingLot,
  editingPolygonRef,
  editingCoords = [],
  isDraggingPolygon,
  startPolygonDrag,
  centerMoveMarkerRef,
  cornerMarkersRef,
  dragCoordsRef,
  handleVertexDrag,
  handleVertexDragEnd,
  handleRemoveVertex,
  midpointHandles = [],
  handleAddVertexAtIndex,
  map,
}) => {
  if (!editingLot) return null;

  return (
    <>
      {/* ── 1. Lower Layer: Active Editing Polygon (zIndex 640) ── */}
      <Pane name="editing-lot-polygon-pane" style={{ zIndex: 640 }}>
        <Polygon
          ref={editingPolygonRef}
          positions={editingCoords}
          pane="editing-lot-polygon-pane"
          pathOptions={{
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 0.45,
            weight: 3.5,
            dashArray: "6, 6",
            className: isDraggingPolygon ? "cursor-grabbing" : "cursor-grab",
          }}
          eventHandlers={{
            mouseover: () => {
              if (map) map.dragging.disable();
            },
            mouseout: () => {
              if (!isDraggingPolygon && map) map.dragging.enable();
            },
            mousedown: (e) => {
              if (e.originalEvent) {
                e.originalEvent.stopPropagation();
                e.originalEvent.preventDefault();
              }
              if (map) map.dragging.disable();
              startPolygonDrag(e.latlng);
            },
          }}
        />
      </Pane>

      {/* ── 2. Upper Layer: All Vertex, Corner & Midpoint Handles (zIndex 680 - Guaranteed on top) ── */}
      <Pane name="editing-lot-handles-pane" style={{ zIndex: 680 }}>
        {/* Center Move Handle (allows grabbing and dragging entire lot effortlessly) */}
        {editingCoords && editingCoords.length >= 3 && (() => {
          const centroid = getPolygonCentroid(editingCoords);
          return (
            <Marker
              ref={centerMoveMarkerRef}
              position={centroid}
              pane="editing-lot-handles-pane"
              draggable={true}
              icon={createPolygonCenterMoveIcon()}
              eventHandlers={{
                mouseover: () => {
                  if (map) map.dragging.disable();
                },
                mouseout: () => {
                  if (!isDraggingPolygon && map) map.dragging.enable();
                },
                dragstart: (e) => {
                  if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                  }
                  if (map) map.dragging.disable();
                  startPolygonDrag(e.target.getLatLng());
                },
                mousedown: (e) => {
                  if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                    e.originalEvent.preventDefault();
                  }
                  if (map) map.dragging.disable();
                  startPolygonDrag(e.latlng);
                },
              }}
            />
          );
        })()}

        {/* Draggable Corner Vertex Handles */}
        {editingCoords.map((coord, index) => (
          <Marker
            key={`handle-${index}`}
            ref={(el) => {
              if (cornerMarkersRef?.current) cornerMarkersRef.current[index] = el;
            }}
            position={coord}
            pane="editing-lot-handles-pane"
            draggable={true}
            icon={createHandleIcon(index)}
            eventHandlers={{
              mouseover: () => {
                if (map) map.dragging.disable();
              },
              mouseout: () => {
                if (map) map.dragging.enable();
              },
              mousedown: (e) => {
                if (e.originalEvent) {
                  e.originalEvent.stopPropagation();
                }
                if (map) {
                  map.dragging.disable();
                }
              },
              dragstart: (e) => {
                if (e.originalEvent) {
                  e.originalEvent.stopPropagation();
                }
                if (map) {
                  map.dragging.disable();
                }
                if (dragCoordsRef && (!dragCoordsRef.current || dragCoordsRef.current.length !== editingCoords.length)) {
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
                if (e.originalEvent) {
                  e.originalEvent.stopPropagation();
                }
                handleRemoveVertex(index);
              },
            }}
          />
        ))}

        {/* Midpoint Split Handles to easily add new corners */}
        {midpointHandles.map((mid, idx) => (
          <Marker
            key={`midpoint-${idx}-${editingCoords.length}`}
            position={mid.position}
            pane="editing-lot-handles-pane"
            icon={createMidpointIcon()}
            eventHandlers={{
              mouseover: () => {
                if (map) map.dragging.disable();
              },
              mouseout: () => {
                if (map) map.dragging.enable();
              },
              mousedown: (e) => {
                if (e.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
              },
              click: (e) => {
                if (e.originalEvent) {
                  e.originalEvent.stopPropagation();
                }
                handleAddVertexAtIndex(mid.insertIndex, mid.position);
              },
            }}
          />
        ))}
      </Pane>
    </>
  );
};

export default EditingLotLayer;
