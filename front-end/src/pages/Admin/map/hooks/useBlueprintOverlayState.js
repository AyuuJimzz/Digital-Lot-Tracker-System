import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import L from "leaflet";
import { useBlueprintLotImport } from "../../../../hooks/useBlueprintLotImport";
import { waitForPropertyFlight } from "../../../../hooks/usePropertyMapNavigation";
import {
  projectBlueprintRoadLabel,
  reframeBlueprintCrop,
  calculateReviewViewportFromMap
} from "../../../../utils/blueprintLotProjection";
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

export function useBlueprintOverlayState({ map, selectedProperty }) {
  const [overlayImage, setOverlayImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayMultiply, setOverlayMultiply] = useState(true);
  const [overlayLineColor, setOverlayLineColor] = useState("lime");
  const [overlayLineBoldness, setOverlayLineBoldness] = useState("super_fine");
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isPreparingOverlay, setIsPreparingOverlay] = useState(false);

  // Overlay management refs
  const originalUploadedImageRef = useRef(null);
  const rawOverlayRef = useRef(null);
  const transparentOverlayRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayFrameRef = useRef(null);
  const overlayCornerMarkersRef = useRef({});
  const overlayMoveStartRef = useRef(null);
  const overlayCornerDragRef = useRef(null);
  const unrotatedSpanRef = useRef(null);
  const overlayOperationRef = useRef(0);
  const activeOverlayPropertyRef = useRef(null);
  const overlayBlobCacheRef = useRef(new Map());
  const activeOverlayUrlRef = useRef(null);
  const reviewViewportRef = useRef(null);

  useEffect(() => {
    activeOverlayPropertyRef.current = selectedProperty;
  }, [selectedProperty]);

  // Integrated Blueprint Lot Import Engine
  const lotImport = useBlueprintLotImport({
    propertyId: selectedProperty,
    map,
    bounds: overlayBounds,
    rotation: overlayRotation,
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

  const automaticRoadAnnotations = useMemo(() => {
    if (!map || !overlayBounds || !lotImport.draft?.roadLabels?.length) return [];
    return lotImport.draft.roadLabels.map((label) => projectBlueprintRoadLabel(
      { ...label, sourceName: lotImport.draft.sourceName }, lotImport.draft,
      overlayBounds, overlayRotation, map,
    )).filter(Boolean);
  }, [map, overlayBounds, overlayRotation, lotImport.draft]);

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

  // Overlay Corner Alignment Handles Handlers
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

      if (overlayRef.current) {
        overlayRef.current.setBounds(newBounds);
      }

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

  // Load Persistent Blueprint Overlay from IndexedDB on Mount or Property Switch
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

          let sourceRevision = data.sourceRevision;
          if (!sourceRevision) {
            sourceRevision = generateSourceRevision();
          }

          const processedCacheKey = `${selectedProperty}:${sourceRevision}:${rotation}:${lineColor}:${lineBoldness}:${multiply ? 1 : 0}`;
          let displayUrl = null;

          const memCached = overlayBlobCacheRef.current.get(selectedProperty);
          if (memCached && memCached.cacheKey === processedCacheKey && memCached.blob instanceof Blob) {
            displayUrl = URL.createObjectURL(memCached.blob);
          }

          if (!displayUrl && data.processedCacheKey === processedCacheKey && data.processedBlob instanceof Blob) {
            overlayBlobCacheRef.current.set(selectedProperty, {
              cacheKey: processedCacheKey,
              blob: data.processedBlob,
            });
            displayUrl = URL.createObjectURL(data.processedBlob);
          }

          if (!displayUrl) {
            const blob = await createTransparentPaperBlob(data.rawImage, lineColor, rotation, lineBoldness, multiply);
            if (isCancelled || operation !== overlayOperationRef.current) return;

            if (blob) {
              overlayBlobCacheRef.current.set(selectedProperty, {
                cacheKey: processedCacheKey,
                blob,
              });
              displayUrl = URL.createObjectURL(blob);

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

  const handleResetOverlay = useCallback(async () => {
    handleRotationChange(0);
  }, [handleRotationChange]);

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

  // Listen for openOverlayPanel event from AdminHeader
  useEffect(() => {
    const handleOpenOverlay = () => setShowOverlayPanel(true);
    window.addEventListener("openOverlayPanel", handleOpenOverlay);
    return () => window.removeEventListener("openOverlayPanel", handleOpenOverlay);
  }, []);

  return {
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
    isPreparingOverlay,
    setIsPreparingOverlay,
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
    reviewViewportRef,
    lotImport,
    handleOpenReview,
    automaticRoadAnnotations,
    createOverlayCornerIcon,
    createOverlayCenterIcon,
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
    saveBlueprintOverlay,
    loadBlueprintOverlay,
    removeBlueprintOverlay,
    restoreLotImport,
    createTransparentPaperImage,
  };
}

export default useBlueprintOverlayState;
