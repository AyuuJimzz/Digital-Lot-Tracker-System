import React from "react";
import { Polygon, Marker, Pane } from "react-leaflet";
import L from "leaflet";

// Side Handle Pill Icons (aligned with bounding box orientation with generous 44x44 hitbox)
const createSidePillIcon = (edgeType, angleDeg = 0) => {
  const rotAngle = -angleDeg + 90;

  return L.divIcon({
    className: "block-adjust-side-handle-icon",
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
      ">
        <!-- Transparent generous hit area to guarantee effortless grabbing -->
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: grab;
        "></div>
        <!-- Stylized Pill Handle -->
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(${rotAngle}deg);
          width: 15px;
          height: 36px;
          background: #4f46e5;
          border: 2.5px solid #ffffff;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.6), 0 0 14px rgba(99, 102, 241, 0.9);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        ">
          <div style="
            width: 3px;
            height: 14px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 1px;
          "></div>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Corner Handle Icons with generous 36x36 hitbox
const createCornerDotIcon = () => {
  return L.divIcon({
    className: "block-adjust-corner-handle-icon",
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: nwse-resize;
      ">
        <!-- Transparent generous hit area -->
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: nwse-resize;
        "></div>
        <!-- Stylized Corner Dot -->
        <div style="
          width: 14px;
          height: 14px;
          background: #ffffff;
          border: 2.5px solid #4f46e5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 10px rgba(99, 102, 241, 0.8);
          border-radius: 50%;
          pointer-events: none;
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};


export function BlockAdjustLayer({
  isBlockAdjusting,
  selectedBlock,
  selectedBlockLots = [],
  boxGeometry,
  blockCentroid,
  scaleX = 1.0,
  scaleY = 1.0,
  handleStartBlockDrag,
  handleStartHandleDrag,
  map,
}) {
  if (!isBlockAdjusting || !selectedBlock || !boxGeometry) return null;

  const { polygon, sides, corners, sideAngles, totalAngle = 0 } = boxGeometry;

  return (
    <>
      {/* ── 1. Lower Layer: Outer Bounding Box Polygon (zIndex 660) ── */}
      <Pane name="block-adjust-polygon-pane" style={{ zIndex: 660 }}>
        <Polygon
          positions={polygon}
          pathOptions={{
            color: "#818cf8",
            fillColor: "#6366f1",
            fillOpacity: 0.06,
            weight: 2,
            dashArray: "6, 6",
            className: "cursor-move",
          }}
          eventHandlers={{
            mousedown: (e) => {
              if (handleStartBlockDrag) handleStartBlockDrag(e);
            },
          }}
        />
      </Pane>

      {/* ── 2. Upper Layer: All Side, Corner & Center Handles (zIndex 720 - Always on top) ── */}
      <Pane name="block-adjust-handles-pane" style={{ zIndex: 720 }}>
        {/* Right (East) Side Handle - Drag to widen/shrink */}
        {sides?.right && (
          <Marker
            position={sides.right}
            icon={createSidePillIcon("right", sideAngles?.right ?? totalAngle)}
            eventHandlers={{
              mouseover: () => map && map.dragging.disable(),
              mouseout: () => map && map.dragging.enable(),
              mousedown: (e) => {
                if (e?.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
                if (handleStartHandleDrag) handleStartHandleDrag("right", e);
              },
            }}
          />
        )}

        {/* Left (West) Side Handle - Drag to widen/shrink */}
        {sides?.left && (
          <Marker
            position={sides.left}
            icon={createSidePillIcon("left", sideAngles?.left ?? totalAngle)}
            eventHandlers={{
              mouseover: () => map && map.dragging.disable(),
              mouseout: () => map && map.dragging.enable(),
              mousedown: (e) => {
                if (e?.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
                if (handleStartHandleDrag) handleStartHandleDrag("left", e);
              },
            }}
          />
        )}

        {/* Top (North) Side Handle - Drag to lengthen/shorten */}
        {sides?.top && (
          <Marker
            position={sides.top}
            icon={createSidePillIcon("top", sideAngles?.top ?? totalAngle)}
            eventHandlers={{
              mouseover: () => map && map.dragging.disable(),
              mouseout: () => map && map.dragging.enable(),
              mousedown: (e) => {
                if (e?.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
                if (handleStartHandleDrag) handleStartHandleDrag("top", e);
              },
            }}
          />
        )}

        {/* Bottom (South) Side Handle - Drag to lengthen/shorten */}
        {sides?.bottom && (
          <Marker
            position={sides.bottom}
            icon={createSidePillIcon("bottom", sideAngles?.bottom ?? totalAngle)}
            eventHandlers={{
              mouseover: () => map && map.dragging.disable(),
              mouseout: () => map && map.dragging.enable(),
              mousedown: (e) => {
                if (e?.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
                if (handleStartHandleDrag) handleStartHandleDrag("bottom", e);
              },
            }}
          />
        )}

        {/* ── Corner Handles (Uniform 2D Scaling) ── */}
        {corners && (
          <>
            <Marker
              position={corners.nw}
              icon={createCornerDotIcon()}
              eventHandlers={{
                mouseover: () => map && map.dragging.disable(),
                mouseout: () => map && map.dragging.enable(),
                mousedown: (e) => {
                  if (e?.originalEvent) {
                    e.originalEvent.stopPropagation();
                    e.originalEvent.preventDefault();
                  }
                  if (handleStartHandleDrag) handleStartHandleDrag("nw", e);
                },
              }}
            />
            <Marker
              position={corners.ne}
              icon={createCornerDotIcon()}
              eventHandlers={{
                mouseover: () => map && map.dragging.disable(),
                mouseout: () => map && map.dragging.enable(),
                mousedown: (e) => {
                  if (e?.originalEvent) {
                    e.originalEvent.stopPropagation();
                    e.originalEvent.preventDefault();
                  }
                  if (handleStartHandleDrag) handleStartHandleDrag("ne", e);
                },
              }}
            />
            <Marker
              position={corners.se}
              icon={createCornerDotIcon()}
              eventHandlers={{
                mouseover: () => map && map.dragging.disable(),
                mouseout: () => map && map.dragging.enable(),
                mousedown: (e) => {
                  if (e?.originalEvent) {
                    e.originalEvent.stopPropagation();
                    e.originalEvent.preventDefault();
                  }
                  if (handleStartHandleDrag) handleStartHandleDrag("se", e);
                },
              }}
            />
            <Marker
              position={corners.sw}
              icon={createCornerDotIcon()}
              eventHandlers={{
                mouseover: () => map && map.dragging.disable(),
                mouseout: () => map && map.dragging.enable(),
                mousedown: (e) => {
                  if (e?.originalEvent) {
                    e.originalEvent.stopPropagation();
                    e.originalEvent.preventDefault();
                  }
                  if (handleStartHandleDrag) handleStartHandleDrag("sw", e);
                },
              }}
            />
          </>
        )}

      </Pane>
    </>
  );
}

export default BlockAdjustLayer;
