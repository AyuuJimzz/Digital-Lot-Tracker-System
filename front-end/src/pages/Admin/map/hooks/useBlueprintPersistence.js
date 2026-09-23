import { useEffect } from "react";
import { waitForPropertyFlight } from "../../../../hooks/usePropertyMapNavigation";
import {
  saveBlueprintOverlay,
  loadBlueprintOverlay,
} from "../../../../utils/overlayStorage";
import {
  generateSourceRevision,
  createTransparentPaperBlob,
} from "../utils/blueprintPaperProcessing";

/**
 * Handles loading persistent blueprint overlay from IndexedDB on mount or property change,
 * memory/disk blob caching, transparent paper generation, and URL revocation.
 */
export function useBlueprintPersistence({
  map,
  selectedProperty,
  setOverlayImage,
  setOverlayBounds,
  setOverlayRotation,
  setOverlayOpacity,
  setOverlayLineColor,
  setOverlayLineBoldness,
  setOverlayMultiply,
  setOverlayVisible,
  setIsEditingOverlay,
  setIsCropModalOpen,
  setIsPreparingOverlay,
  restoreLotImport,
  rawOverlayRef,
  originalUploadedImageRef,
  unrotatedSpanRef,
  reviewViewportRef,
  overlayOperationRef,
  overlayBlobCacheRef,
  activeOverlayUrlRef,
  transparentOverlayRef,
}) {
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
  }, [
    selectedProperty,
    restoreLotImport,
    map,
    setOverlayImage,
    setOverlayBounds,
    setOverlayRotation,
    setOverlayOpacity,
    setOverlayLineColor,
    setOverlayLineBoldness,
    setOverlayMultiply,
    setOverlayVisible,
    setIsEditingOverlay,
    setIsCropModalOpen,
    setIsPreparingOverlay,
    rawOverlayRef,
    originalUploadedImageRef,
    unrotatedSpanRef,
    reviewViewportRef,
    overlayOperationRef,
    overlayBlobCacheRef,
    activeOverlayUrlRef,
    transparentOverlayRef,
  ]);

  // Overall unmount cleanup for blob cache and URLs
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
  }, [activeOverlayUrlRef, transparentOverlayRef, overlayBlobCacheRef]);
}

export default useBlueprintPersistence;
