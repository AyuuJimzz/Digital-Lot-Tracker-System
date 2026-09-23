import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useBlueprintLotImport } from "../../../../hooks/useBlueprintLotImport";
import {
  projectBlueprintRoadLabel,
  calculateReviewViewportFromMap,
} from "../../../../utils/blueprintLotProjection";
import {
  saveBlueprintOverlay,
  loadBlueprintOverlay,
  removeBlueprintOverlay,
} from "../../../../utils/overlayStorage";
import { createTransparentPaperImage } from "../utils/blueprintPaperProcessing";
import {
  getRotatedBlueprintCorners,
  createOverlayCornerIcon,
  createOverlayCenterIcon,
} from "../utils/blueprintTransformUtils";
import { useBlueprintTransformGestures } from "./useBlueprintTransformGestures";
import { useBlueprintPersistence } from "./useBlueprintPersistence";
import { useBlueprintImageProcessing } from "./useBlueprintImageProcessing";

export { getRotatedBlueprintCorners };

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
    return lotImport.draft.roadLabels
      .map((label) =>
        projectBlueprintRoadLabel(
          { ...label, sourceName: lotImport.draft.sourceName },
          lotImport.draft,
          overlayBounds,
          overlayRotation,
          map
        )
      )
      .filter(Boolean);
  }, [map, overlayBounds, overlayRotation, lotImport.draft]);

  // Sub-hook 1: IndexedDB persistence & cache lifecycle
  useBlueprintPersistence({
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
  });

  // Sub-hook 2: Corner dragging and scaling gestures
  const {
    handleOverlayCornerDragStart,
    handleOverlayCornerDrag,
    handleOverlayCornerDragEnd,
    handleScaleOverlay,
  } = useBlueprintTransformGestures({
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
  });

  // Sub-hook 3: Image styling, crop, and upload processing
  const {
    handleRotationChange,
    handleLineColorChange,
    handleLineBoldnessChange,
    handleApplyCrop,
    handleResetOverlay,
    handleImageUpload,
  } = useBlueprintImageProcessing({
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
    lotImportDraft: lotImport.draft,
    rawOverlayRef,
    originalUploadedImageRef,
    transparentOverlayRef,
    overlayRef,
    unrotatedSpanRef,
    overlayOperationRef,
    activeOverlayPropertyRef,
    overlayBlobCacheRef,
  });

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
