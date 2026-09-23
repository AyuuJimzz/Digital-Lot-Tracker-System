import { useCallback } from "react";
import { reframeBlueprintCrop } from "../../../../utils/blueprintLotProjection";
import { saveBlueprintOverlay } from "../../../../utils/overlayStorage";
import {
  toDataURL,
  generateSourceRevision,
  createTransparentPaperImage,
} from "../utils/blueprintPaperProcessing";

/**
 * Handles live styling changes (color, boldness, rotation), crop application,
 * image uploading, and blueprint alignment resets.
 */
export function useBlueprintImageProcessing({
  map,
  selectedProperty,
  overlayBounds,
  setOverlayBounds,
  overlayRotation,
  setOverlayRotation,
  overlayOpacity,
  overlayLineColor,
  setOverlayLineColor,
  overlayLineBoldness,
  setOverlayLineBoldness,
  overlayMultiply,
  setOverlayImage,
  setOverlayVisible,
  setIsEditingOverlay,
  setIsPreparingOverlay,
  applyLotImportCrop,
  restoreLotImport,
  lotImportDraft,
  rawOverlayRef,
  originalUploadedImageRef,
  transparentOverlayRef,
  overlayRef,
  unrotatedSpanRef,
  overlayOperationRef,
  activeOverlayPropertyRef,
  overlayBlobCacheRef,
}) {
  const handleRotationChange = useCallback(
    async (deg) => {
      if (!Number.isFinite(deg)) return;
      setOverlayRotation(deg);
      const operation = ++overlayOperationRef.current;
      const baseImg = rawOverlayRef.current || originalUploadedImageRef.current;
      if (!baseImg) return;

      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(
        baseImg,
        overlayLineColor,
        deg,
        overlayLineBoldness,
        overlayMultiply
      );
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      ) {
        URL.revokeObjectURL(transUrl);
        return;
      }
      setIsPreparingOverlay(false);
      if (transparentOverlayRef.current && transparentOverlayRef.current !== transUrl) {
        try {
          URL.revokeObjectURL(transparentOverlayRef.current);
        } catch (e) {}
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

        const baseLatSpan = unrotatedSpanRef.current
          ? unrotatedSpanRef.current.latSpan
          : Math.abs(prev[1][0] - prev[0][0]);
        const baseLngSpan = unrotatedSpanRef.current
          ? unrotatedSpanRef.current.lngSpan
          : Math.abs(prev[1][1] - prev[0][1]);

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
    [
      overlayLineColor,
      overlayLineBoldness,
      selectedProperty,
      overlayBounds,
      overlayOpacity,
      overlayMultiply,
      setOverlayRotation,
      setIsPreparingOverlay,
      setOverlayImage,
      setOverlayBounds,
      overlayOperationRef,
      rawOverlayRef,
      originalUploadedImageRef,
      activeOverlayPropertyRef,
      transparentOverlayRef,
      unrotatedSpanRef,
      overlayRef,
    ]
  );

  const handleLineColorChange = useCallback(
    async (color) => {
      setOverlayLineColor(color);
      const src = rawOverlayRef.current;
      if (!src) return;
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(
        src,
        color,
        overlayRotation,
        overlayLineBoldness,
        overlayMultiply
      );
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      ) {
        URL.revokeObjectURL(transUrl);
        return;
      }
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
    [
      overlayRotation,
      overlayLineBoldness,
      selectedProperty,
      overlayBounds,
      overlayOpacity,
      overlayMultiply,
      setOverlayLineColor,
      setIsPreparingOverlay,
      setOverlayImage,
      rawOverlayRef,
      originalUploadedImageRef,
      overlayOperationRef,
      activeOverlayPropertyRef,
      transparentOverlayRef,
      unrotatedSpanRef,
    ]
  );

  const handleLineBoldnessChange = useCallback(
    async (boldness) => {
      setOverlayLineBoldness(boldness);
      const src = rawOverlayRef.current;
      if (!src) return;
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const transUrl = await createTransparentPaperImage(
        src,
        overlayLineColor,
        overlayRotation,
        boldness,
        overlayMultiply
      );
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      ) {
        URL.revokeObjectURL(transUrl);
        return;
      }
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
    [
      overlayLineColor,
      overlayRotation,
      selectedProperty,
      overlayBounds,
      overlayOpacity,
      overlayMultiply,
      setOverlayLineBoldness,
      setIsPreparingOverlay,
      setOverlayImage,
      rawOverlayRef,
      originalUploadedImageRef,
      overlayOperationRef,
      activeOverlayPropertyRef,
      transparentOverlayRef,
      unrotatedSpanRef,
    ]
  );

  const handleApplyCrop = useCallback(
    async (croppedUrl, cropBounds) => {
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const dataUrl = await toDataURL(croppedUrl);
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      )
        return;
      applyLotImportCrop(cropBounds);
      setIsEditingOverlay(true);
      rawOverlayRef.current = dataUrl;
      const cropRotation = lotImportDraft ? overlayRotation : 0;
      setOverlayRotation(cropRotation);
      const transUrl = await createTransparentPaperImage(
        dataUrl,
        overlayLineColor,
        cropRotation,
        overlayLineBoldness,
        overlayMultiply
      );
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      ) {
        URL.revokeObjectURL(transUrl);
        return;
      }
      transparentOverlayRef.current = transUrl;
      setOverlayImage(transUrl);
      setIsPreparingOverlay(false);

      let finalBounds = overlayBounds;
      let finalSpan = unrotatedSpanRef.current;

      if (overlayBounds && lotImportDraft && map && cropBounds) {
        const reframed = reframeBlueprintCrop(
          lotImportDraft,
          cropBounds,
          overlayBounds,
          cropRotation,
          map
        );
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
    [
      overlayBounds,
      overlayLineColor,
      overlayLineBoldness,
      selectedProperty,
      overlayOpacity,
      overlayMultiply,
      applyLotImportCrop,
      lotImportDraft,
      overlayRotation,
      map,
      setIsPreparingOverlay,
      setIsEditingOverlay,
      setOverlayRotation,
      setOverlayImage,
      setOverlayBounds,
      overlayOperationRef,
      activeOverlayPropertyRef,
      rawOverlayRef,
      transparentOverlayRef,
      unrotatedSpanRef,
      overlayRef,
      overlayBlobCacheRef,
      originalUploadedImageRef,
    ]
  );

  const handleResetOverlay = useCallback(async () => {
    handleRotationChange(0);
  }, [handleRotationChange]);

  const handleImageUpload = useCallback(
    async (imageUrl, importSource = null, originalImageUrl = imageUrl) => {
      const operation = ++overlayOperationRef.current;
      setIsPreparingOverlay(true);
      const dataUrl = await toDataURL(imageUrl);
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      )
        return;
      if (rawOverlayRef.current && rawOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(rawOverlayRef.current);
      }
      if (transparentOverlayRef.current && transparentOverlayRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(transparentOverlayRef.current);
      }

      originalUploadedImageRef.current = originalImageUrl || dataUrl;
      rawOverlayRef.current = dataUrl;
      setOverlayRotation(0);

      const transUrl = await createTransparentPaperImage(
        dataUrl,
        overlayLineColor,
        0,
        overlayLineBoldness,
        overlayMultiply
      );
      if (
        operation !== overlayOperationRef.current ||
        activeOverlayPropertyRef.current !== selectedProperty
      ) {
        URL.revokeObjectURL(transUrl);
        return;
      }
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
    [
      map,
      overlayLineColor,
      overlayLineBoldness,
      selectedProperty,
      overlayOpacity,
      overlayMultiply,
      restoreLotImport,
      setIsPreparingOverlay,
      setOverlayRotation,
      setOverlayImage,
      setOverlayVisible,
      setIsEditingOverlay,
      setOverlayBounds,
      overlayOperationRef,
      activeOverlayPropertyRef,
      rawOverlayRef,
      transparentOverlayRef,
      originalUploadedImageRef,
      unrotatedSpanRef,
      overlayBlobCacheRef,
    ]
  );

  return {
    handleRotationChange,
    handleLineColorChange,
    handleLineBoldnessChange,
    handleApplyCrop,
    handleResetOverlay,
    handleImageUpload,
  };
}

export default useBlueprintImageProcessing;
