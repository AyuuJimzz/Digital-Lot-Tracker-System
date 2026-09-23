import { useCallback } from "react";
import { getRotatedBlueprintCorners } from "../utils/blueprintTransformUtils";
import { saveBlueprintOverlay } from "../../../../utils/overlayStorage";

/**
 * Handles interactive corner handle dragging, live Leaflet frame updates,
 * and proportional scaling of the blueprint image overlay.
 */
export function useBlueprintTransformGestures({
  map,
  selectedProperty,
  overlayRotation,
  overlayOpacity,
  overlayLineColor,
  overlayMultiply,
  setOverlayBounds,
  overlayRef,
  overlayFrameRef,
  overlayCornerMarkersRef,
  overlayCornerDragRef,
  unrotatedSpanRef,
  rawOverlayRef,
  originalUploadedImageRef,
}) {
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
    [map, overlayRotation, unrotatedSpanRef, overlayCornerDragRef]
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

      if (overlayRef.current) {
        overlayRef.current.setBounds(newBounds);
      }

      const liveCorners = getRotatedBlueprintCorners(newBounds, overlayRotation, {
        latSpan: baseLatSpan,
        lngSpan: baseLngSpan,
      });
      if (liveCorners) {
        if (overlayFrameRef.current) {
          overlayFrameRef.current.setLatLngs([
            liveCorners.nw,
            liveCorners.ne,
            liveCorners.se,
            liveCorners.sw,
          ]);
        }
        ["nw", "ne", "se", "sw"].forEach((cKey) => {
          if (cKey !== corner && overlayCornerMarkersRef.current[cKey]) {
            overlayCornerMarkersRef.current[cKey].setLatLng(liveCorners[cKey]);
          }
        });
      }
    },
    [
      overlayRotation,
      overlayRef,
      overlayFrameRef,
      overlayCornerMarkersRef,
      overlayCornerDragRef,
      unrotatedSpanRef,
    ]
  );

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
  }, [
    map,
    selectedProperty,
    overlayRotation,
    overlayOpacity,
    overlayLineColor,
    overlayMultiply,
    setOverlayBounds,
    overlayCornerDragRef,
    rawOverlayRef,
    originalUploadedImageRef,
    unrotatedSpanRef,
  ]);

  const handleScaleOverlay = useCallback(
    (factor) => {
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
    },
    [
      selectedProperty,
      overlayRotation,
      overlayOpacity,
      overlayLineColor,
      overlayMultiply,
      setOverlayBounds,
      overlayRef,
      rawOverlayRef,
      originalUploadedImageRef,
      unrotatedSpanRef,
    ]
  );

  return {
    handleOverlayCornerDragStart,
    handleOverlayCornerDrag,
    handleOverlayCornerDragEnd,
    handleScaleOverlay,
  };
}

export default useBlueprintTransformGestures;
