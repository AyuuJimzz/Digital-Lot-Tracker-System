import React from "react";
import { ImageOverlay, Polygon, Marker } from "react-leaflet";

// Helper: computes exact 4 GPS corners of the rotated blueprint image
export const getRotatedBlueprintCorners = (bounds, rotationDeg, unrotatedSpan) => {
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

export const BlueprintOverlayLayer = ({
  overlayImage,
  overlayBounds,
  overlayVisible,
  overlayOpacity,
  overlayRef,
  isEditingOverlay,
  overlayRotation,
  unrotatedSpanRef,
  overlayFrameRef,
  overlayCornerMarkersRef,
  createOverlayCornerIcon,
  handleOverlayCornerDragStart,
  handleOverlayCornerDrag,
  handleOverlayCornerDragEnd,
  createOverlayCenterIcon,
  map,
  overlayMoveStartRef,
  setOverlayBounds,
  selectedProperty,
  rawOverlayRef,
  originalUploadedImageRef,
  saveBlueprintOverlay,
  handlePropertyMoved,
  overlayLineColor,
  overlayMultiply,
}) => {
  if (!overlayImage || !overlayBounds || !overlayVisible) return null;

  // Hide alignment boundary frame and handles when zoomed out in regional overview (< 16.5)
  // so corner markers and dashed polygons don't clutter the satellite overview map
  const isZoomedForEditing = !map || map.getZoom() >= 16.5;

  const corners = isEditingOverlay && isZoomedForEditing
    ? getRotatedBlueprintCorners(overlayBounds, overlayRotation, unrotatedSpanRef?.current)
    : null;

  const cLat = (overlayBounds[0][0] + overlayBounds[1][0]) / 2;
  const cLng = (overlayBounds[0][1] + overlayBounds[1][1]) / 2;

  return (
    <>
      {/* ── Site Plan Image Overlay ── */}
      <ImageOverlay
        ref={overlayRef}
        url={overlayImage}
        bounds={overlayBounds}
        opacity={overlayOpacity}
        zIndex={10}
      />

      {/* ── Overlay Blueprint Frame / Boundary Guide ── */}
      {isEditingOverlay && corners && (
        <>
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

          {/* SW Corner Handle */}
          <Marker
            ref={(el) => {
              if (el && overlayCornerMarkersRef?.current) overlayCornerMarkersRef.current["sw"] = el;
            }}
            position={corners.sw}
            draggable={true}
            icon={createOverlayCornerIcon("SW")}
            eventHandlers={{
              dragstart: () => handleOverlayCornerDragStart("sw", overlayBounds),
              drag: (e) => handleOverlayCornerDrag("sw", e),
              dragend: handleOverlayCornerDragEnd,
            }}
          />

          {/* SE Corner Handle */}
          <Marker
            ref={(el) => {
              if (el && overlayCornerMarkersRef?.current) overlayCornerMarkersRef.current["se"] = el;
            }}
            position={corners.se}
            draggable={true}
            icon={createOverlayCornerIcon("SE")}
            eventHandlers={{
              dragstart: () => handleOverlayCornerDragStart("se", overlayBounds),
              drag: (e) => handleOverlayCornerDrag("se", e),
              dragend: handleOverlayCornerDragEnd,
            }}
          />

          {/* NE Corner Handle */}
          <Marker
            ref={(el) => {
              if (el && overlayCornerMarkersRef?.current) overlayCornerMarkersRef.current["ne"] = el;
            }}
            position={corners.ne}
            draggable={true}
            icon={createOverlayCornerIcon("NE")}
            eventHandlers={{
              dragstart: () => handleOverlayCornerDragStart("ne", overlayBounds),
              drag: (e) => handleOverlayCornerDrag("ne", e),
              dragend: handleOverlayCornerDragEnd,
            }}
          />

          {/* NW Corner Handle */}
          <Marker
            ref={(el) => {
              if (el && overlayCornerMarkersRef?.current) overlayCornerMarkersRef.current["nw"] = el;
            }}
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
      )}

      {/* ── Overlay Center Move Handle ── */}
      {isEditingOverlay && (
        <Marker
          position={[cLat, cLng]}
          draggable={true}
          icon={createOverlayCenterIcon()}
          eventHandlers={{
            dragstart: (e) => {
              if (map) map.dragging.disable();
              if (overlayMoveStartRef) {
                overlayMoveStartRef.current = {
                  startLat: e.target.getLatLng().lat,
                  startLng: e.target.getLatLng().lng,
                  initBounds: overlayBounds.map((c) => [...c]),
                };
              }
            },
            drag: (e) => {
              if (!overlayMoveStartRef?.current || !overlayRef?.current) return;
              const { lat, lng } = e.target.getLatLng();
              const { startLat, startLng, initBounds } = overlayMoveStartRef.current;
              const dLat = lat - startLat;
              const dLng = lng - startLng;
              const newBounds = [
                [initBounds[0][0] + dLat, initBounds[0][1] + dLng],
                [initBounds[1][0] + dLat, initBounds[1][1] + dLng],
              ];
              // Update Leaflet ImageOverlay directly
              overlayRef.current.setBounds(newBounds);

              // Update rotation frame polygon and 4 corner markers in real-time
              const newCorners = getRotatedBlueprintCorners(newBounds, overlayRotation, unrotatedSpanRef?.current);
              if (newCorners) {
                if (overlayFrameRef?.current) {
                  overlayFrameRef.current.setLatLngs([
                    newCorners.nw,
                    newCorners.ne,
                    newCorners.se,
                    newCorners.sw,
                  ]);
                }
                if (overlayCornerMarkersRef?.current) {
                  ["sw", "se", "ne", "nw"].forEach((pos) => {
                    const marker = overlayCornerMarkersRef.current[pos];
                    if (marker && newCorners[pos]) {
                      marker.setLatLng(newCorners[pos]);
                    }
                  });
                }
              }
            },
            dragend: (e) => {
              if (map) map.dragging.enable();
              if (!overlayMoveStartRef?.current) return;
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

              if (selectedProperty && rawOverlayRef?.current && saveBlueprintOverlay) {
                saveBlueprintOverlay(selectedProperty, {
                  rawImage: rawOverlayRef.current,
                  originalImage: originalUploadedImageRef?.current || rawOverlayRef.current,
                  bounds: finalBounds,
                  rotation: overlayRotation,
                  opacity: overlayOpacity,
                  lineColor: overlayLineColor,
                  multiply: overlayMultiply,
                  unrotatedSpan: unrotatedSpanRef?.current,
                });
              }

              // Auto-sync property anchor with the dragged blueprint location!
              if (selectedProperty && handlePropertyMoved) {
                const centerLat = (finalBounds[0][0] + finalBounds[1][0]) / 2;
                const centerLng = (finalBounds[0][1] + finalBounds[1][1]) / 2;
                handlePropertyMoved(selectedProperty, [centerLat, centerLng], true);
              }
            },
          }}
        />
      )}
    </>
  );
};

export default BlueprintOverlayLayer;
