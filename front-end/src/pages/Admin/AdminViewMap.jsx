import React from "react";
import L from "leaflet";
import { MapContainer, Pane } from "react-leaflet";
import { ViewportLotLayer } from "../../components/admin/ViewportLotLayer";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import { MapLayerControls, ActiveMapTileLayer } from "../../components/admin/MapLayerControls";
import { UnifiedLotEditorPanel } from "../../components/admin/UnifiedLotEditorPanel";
import LotOffcanvas from "../../components/admin/LotOffcanvas";
import { ImageOverlayControl } from "../../components/admin/ImageOverlayControl";
import { BlueprintCropModal } from "../../components/admin/BlueprintCropModal";
import { LotImportReviewModal } from "../../components/admin/LotImportReviewModal";
import { MapAnnotationControl } from "../../components/admin/MapAnnotationControl";
import { calculateMapViewportFromReview } from "../../utils/blueprintLotProjection";

// Sub-components: Extracted Map layers & controls
import MapController from "./map/components/MapController";
import MapTouchPopup from "./map/components/MapTouchPopup";
import BulkShiftAlignmentPanel from "./map/components/BulkShiftAlignmentPanel";
import BulkShiftModal from "./map/modals/BulkShiftModal";
import DuplicateLotModal from "./map/modals/DuplicateLotModal";
import OverviewBeaconsLayer from "./map/layers/OverviewBeaconsLayer";
import BlueprintOverlayLayer from "./map/layers/BlueprintOverlayLayer";
import EditingLotLayer from "./map/layers/EditingLotLayer";
import MapAnnotationsLayer from "./map/layers/MapAnnotationsLayer";
import LotImportCandidateLayer from "./map/layers/LotImportCandidateLayer";

import useAdminViewMap from "./map/hooks/useAdminViewMap";

// Fix for default icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function AdminViewMap() {
  const mapState = useAdminViewMap();

  if (!mapState.mapData) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-600 dark:text-slate-400"
        style={{ height: "calc(100vh - 3.5rem)" }}
      >
        {mapState.mapError ? (
          <div role="alert" className="text-center p-6 max-w-sm rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 shadow-sm">
            <p className="text-sm font-medium">Unable to load Estate Map. Please check your connection.</p>
            <button
              type="button"
              onClick={() => mapState.retryMapData()}
              className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div role="status" className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium text-gray-600 dark:text-slate-400">Loading Estate Map...</span>
          </div>
        )}
      </div>
    );
  }

  const {
    mapWrapperRef,
    showAnnotationPanel,
    setShowAnnotationPanel,
    isEditingAnnotations,
    properties,
    selectedPropertyCoords,
    mapLayer,
    setMapLayer,
    selectedProperty,
    setSelectedProperty,
    triggerArrivalPulse,
    setMap,
    setCurrentZoom,
    map,
    filteredLots,
    renderLot,
    showLotTooltips,
    isBulkShifting,
    isTouchDevice,
    shiftedPropertyId,
    bulkShiftOffset,
    editingLot,
    setEditingLot,
    quickLotNumber,
    setQuickLotNumber,
    quickAreaSqm,
    setQuickAreaSqm,
    targetAreaSqm,
    handleResetToSquareSize,
    liveAreaSqm,
    quickStatus,
    setQuickStatus,
    enableSnapping,
    setEnableSnapping,
    handleScaleEditingCoords,
    handleDuplicateLot,
    handleSaveUnifiedLot,
    handleSaveUnifiedAndNext,
    setEditingCoords,
    isSavingCoords,
    floatingPos,
    handleFloatingMouseDown,
    selectedLot,
    setSelectedLot,
    isOffcanvasOpen,
    setIsOffcanvasOpen,
    handleLotUpdated,
    handleLiveLotUpdate,
    showOverlayPanel,
    setShowOverlayPanel,
    lotImport,
    handleOpenReview,
    isPreparingOverlay,
    setIsPreparingOverlay,
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
    overlayRotation,
    setOverlayRotation,
    overlayMultiply,
    setOverlayMultiply,
    overlayLineColor,
    overlayLineBoldness,
    handleLineColorChange,
    handleLineBoldnessChange,
    handleImageUpload,
    handleRotationChange,
    handleResetOverlay,
    handleScaleOverlay,
    isCropModalOpen,
    setIsCropModalOpen,
    handleToggleOverlayEdit,
    setIsBulkShifting,
    setBulkShiftOffset,
    restoreLotImport,
    activeOverlayUrlRef,
    overlayBlobCacheRef,
    rawOverlayRef,
    originalUploadedImageRef,
    transparentOverlayRef,
    unrotatedSpanRef,
    reviewViewportRef,
    removeBlueprintOverlay,
    saveBlueprintOverlay,
    overlayOperationRef,
    activeOverlayPropertyRef,
    createTransparentPaperImage,
    handleApplyCrop,
    duplicateModalData,
    setDuplicateModalData,
    handleConfirmDuplicateLot,
    annotations,
    activeAnnotationId,
    setActiveAnnotationId,
    handleAddAnnotation,
    handleUpdateAnnotation,
    handleUpdateAllAnnotations,
    handleDeleteAnnotation,
    handleDeleteAllAnnotations,
    handleSaveAnnotations,
    isSavingAnnotations,
    setIsEditingAnnotations,
  } = mapState;

  return (
    <div
      ref={mapWrapperRef}
      className={`w-full h-full relative ${showAnnotationPanel && isEditingAnnotations ? "map-editing-labels-active" : ""}`}
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={properties && properties.length > 0 ? selectedPropertyCoords : [10.90, 122.60]}
        zoom={properties && properties.length > 0 ? 19 : 9}
        preferCanvas={true}
        zoomDelta={0.25}
        zoomSnap={0}
        wheelPxPerZoomLevel={220}
        wheelDebounceTime={20}
        minZoom={7}
        maxZoom={28}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        fadeAnimation={false}
        markerZoomAnimation={true}
        touchZoom={true}
        tap={false}
        bounceAtZoomLimits={false}
        inertia={true}
        inertiaDeceleration={6000}
        inertiaMaxSpeed={700}
        style={{ height: "100%", width: "100%", zIndex: 1, touchAction: "manipulation" }}
      >
        <MapLocationSearch
          onLocationSelected={(loc) => {
            triggerArrivalPulse(loc.coordinates);
          }}
        />
        <MapLayerControls
          activeLayer={mapLayer}
          onLayerChange={(newLayer) => {
            setMapLayer(newLayer);
            localStorage.setItem("preferredMapLayer", newLayer);
          }}
          mapContainerRef={mapWrapperRef}
        />
        <MapController
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
          triggerArrivalPulse={triggerArrivalPulse}
          setMap={setMap}
          setCurrentZoom={setCurrentZoom}
          mapLayer={mapLayer}
          properties={properties}
        />
        <ActiveMapTileLayer activeLayer={mapLayer} />

        {/* ── Single Map-Level Controlled Popup for Tablet Touch Devices ── */}
        <MapTouchPopup
          activePopupLot={mapState.activePopupLot}
          setActivePopupLot={mapState.setActivePopupLot}
          properties={properties}
          selectedProperty={selectedProperty}
          setSelectedLot={setSelectedLot}
          setIsOffcanvasOpen={setIsOffcanvasOpen}
        />

        {/* ── Zoomed-Out Overview Green Property Location Beacons ── */}
        <OverviewBeaconsLayer
          properties={properties}
          setSelectedProperty={setSelectedProperty}
        />

        {/* ── Projected Candidate Lots During Blueprint Import ── */}
        <LotImportCandidateLayer
          lotImport={lotImport}
          isEditingOverlay={isEditingOverlay}
          isPreparingOverlay={isPreparingOverlay}
          overlayLineColor={overlayLineColor}
        />

        {/* ── Site Plan Image Overlay, Boundary Frame & Handles ── */}
        <BlueprintOverlayLayer {...mapState} />

        {/* ── Base Mapped Lots Viewport Layer ── */}
        <Pane name="lot-plan" className="lot-plan-pane" style={{ zIndex: 410 }}>
          <ViewportLotLayer
            lots={filteredLots}
            renderLot={renderLot}
            showTooltips={showLotTooltips && !isBulkShifting && !isOffcanvasOpen}
            isTouchDevice={isTouchDevice}
            offsetPropertyId={shiftedPropertyId}
            offset={bulkShiftOffset}
          />
        </Pane>

        {/* ── Active Coordinate Editing Polygon & Vertex Handles ── */}
        <EditingLotLayer {...mapState} />

        {/* ── Road & Map Text Labels Layer ── */}
        <MapAnnotationsLayer {...mapState} />
      </MapContainer>

      {/* Unified Lot Editor Panel */}
      {editingLot && !isBulkShifting && (
        <UnifiedLotEditorPanel
          isOpen={Boolean(editingLot)}
          isNewLot={Boolean(editingLot?.isNew)}
          lotNumber={
            editingLot?.isNew
              ? quickLotNumber
              : (editingLot?.lot_number || "")
          }
          onLotNumberChange={(val) => {
            if (editingLot?.isNew) {
              setQuickLotNumber(val);
            }
            setEditingLot((prev) => (prev ? { ...prev, lot_number: val } : prev));
          }}
          targetArea={
            editingLot?.isNew
              ? quickAreaSqm
              : (targetAreaSqm || editingLot?.area_sqm || 100)
          }
          onTargetAreaChange={(val) => {
            const num = parseFloat(val) || 0;
            if (editingLot?.isNew) {
              setQuickAreaSqm(num);
            }
            setEditingLot((prev) => (prev ? { ...prev, area_sqm: num } : prev));
            if (num > 0) {
              handleResetToSquareSize(num);
            }
          }}
          liveArea={liveAreaSqm}
          status={
            editingLot?.isNew
              ? quickStatus
              : (editingLot?.status || "Available")
          }
          onStatusChange={(val) => {
            if (editingLot?.isNew) {
              setQuickStatus(val);
            }
            setEditingLot((prev) => (prev ? { ...prev, status: val } : prev));
          }}
          enableSnapping={enableSnapping}
          onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
          onScaleCoords={handleScaleEditingCoords}
          onFitSquare={handleResetToSquareSize}
          onDuplicate={handleDuplicateLot}
          onSave={handleSaveUnifiedLot}
          onSaveAndNext={handleSaveUnifiedAndNext}
          onCancel={() => {
            setEditingLot(null);
            setEditingCoords([]);
          }}
          isSaving={isSavingCoords}
          floatingPos={floatingPos}
          onMouseDownHeader={handleFloatingMouseDown}
        />
      )}

      {/* Floating Bulk Shift Alignment Editor Panel */}
      <BulkShiftAlignmentPanel {...mapState} />

      {/* In-App Bulk Shift Confirmation Modal */}
      <BulkShiftModal {...mapState} />

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        isAdmin={true}
        selectedLot={selectedLot}
        propertyName={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.property_name ||
          "Golden Dragon Estate"
        }
        propertyLocation={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.location ||
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.location ||
          "Guimbal, Iloilo"
        }
        isOpen={isOffcanvasOpen}
        onClose={() => setIsOffcanvasOpen(false)}
        onLotUpdated={handleLotUpdated}
        onLiveLotUpdate={handleLiveLotUpdate}
        allowedStatuses={["Available", "Pending", "Sold"]}
        showCoordinateEdit={true}
        onDuplicateLot={(lot) => {
          setIsOffcanvasOpen(false);
          handleDuplicateLot(lot);
        }}
        onStartCoordinateEdit={(lot) => {
          setIsOffcanvasOpen(false);
          let rawCoords = lot.coordinates;
          if (typeof rawCoords === "string") {
            try {
              rawCoords = JSON.parse(rawCoords);
            } catch (e) {
              rawCoords = null;
            }
          }
          if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length === 0) {
            const found = mapState.mapData?.lots?.find((l) => Number(l.lot_id) === Number(lot.lot_id));
            if (found?.coordinates) {
              rawCoords =
                typeof found.coordinates === "string"
                  ? JSON.parse(found.coordinates)
                  : found.coordinates;
            }
          }
          window.dispatchEvent(
            new CustomEvent("startVisualEdit", {
              detail: {
                lot_id: lot.lot_id,
                lot_number: lot.lot_number,
                property_id: lot.property_id,
                coordinates: rawCoords,
                area_sqm: lot.area_sqm,
                status: lot.status,
              },
            })
          );
        }}
      />

      {/* Site Plan Overlay Control Panel */}
      {showOverlayPanel && (
        <ImageOverlayControl
          key={selectedProperty}
          importCount={lotImport.candidates.length}
          roadLabelCount={lotImport.draft?.roadLabels?.length || 0}
          hasImportSource={Boolean(lotImport.draft)}
          importWarnings={lotImport.draft?.warnings || []}
          importMessage={lotImport.message}
          importError={lotImport.error}
          onReviewImport={handleOpenReview}
          previewImport={lotImport.preview}
          onToggleImportPreview={lotImport.togglePreview}
          isPreparingOverlay={isPreparingOverlay}
          overlayImage={overlayImage}
          overlayOpacity={overlayOpacity}
          overlayVisible={overlayVisible}
          isEditingOverlay={isEditingOverlay}
          overlayRotation={overlayRotation}
          overlayMultiply={overlayMultiply}
          overlayLineColor={overlayLineColor}
          overlayLineBoldness={overlayLineBoldness}
          onLineColorChange={handleLineColorChange}
          onLineBoldnessChange={handleLineBoldnessChange}
          isBulkShifting={isBulkShifting}
          onImageUpload={handleImageUpload}
          onOpacityChange={setOverlayOpacity}
          onToggleMultiply={async () => {
            const next = !overlayMultiply;
            const operation = ++overlayOperationRef.current;
            setIsPreparingOverlay(true);
            const image = await createTransparentPaperImage(rawOverlayRef.current, overlayLineColor, overlayRotation, overlayLineBoldness, next);
            if (operation !== overlayOperationRef.current || activeOverlayPropertyRef.current !== selectedProperty) { URL.revokeObjectURL(image); return; }
            setOverlayMultiply(next);
            setOverlayImage(image);
            transparentOverlayRef.current = image;
            setIsPreparingOverlay(false);
            await saveBlueprintOverlay(selectedProperty, { multiply: next });
          }}
          onRotationChange={handleRotationChange}
          onRotate90={(delta) => handleRotationChange((overlayRotation + delta) % 360)}
          onReset={handleResetOverlay}
          onScaleOverlay={handleScaleOverlay}
          onOpenCrop={() => setIsCropModalOpen(true)}
          onToggleVisible={() => setOverlayVisible((prev) => !prev)}
          onToggleEdit={handleToggleOverlayEdit}
          onToggleBulkShift={() => {
            setIsBulkShifting((prev) => !prev);
            setBulkShiftOffset({ lat: 0, lng: 0 });
          }}
          onRemove={async () => {
            ++overlayOperationRef.current;
            restoreLotImport(null);
            setIsPreparingOverlay(false);
            if (activeOverlayUrlRef.current && activeOverlayUrlRef.current.startsWith("blob:")) {
              try { URL.revokeObjectURL(activeOverlayUrlRef.current); } catch (e) {}
              activeOverlayUrlRef.current = null;
            } else if (overlayImage && overlayImage.startsWith("blob:")) {
              try { URL.revokeObjectURL(overlayImage); } catch (e) {}
            }
            if (selectedProperty) {
              overlayBlobCacheRef.current.delete(selectedProperty);
            }
            setOverlayImage(null);
            setOverlayBounds(null);
            setIsEditingOverlay(false);
            setOverlayRotation(0);
            rawOverlayRef.current = null;
            originalUploadedImageRef.current = null;
            transparentOverlayRef.current = null;
            unrotatedSpanRef.current = null;
            reviewViewportRef.current = null;
            if (selectedProperty) {
              await removeBlueprintOverlay(selectedProperty);
            }
          }}
          onClose={() => setShowOverlayPanel(false)}
        />
      )}

      {/* Lot Import Review Modal */}
      {lotImport.isReviewOpen && (
        <LotImportReviewModal
          candidates={lotImport.candidates}
          onCandidatesChange={lotImport.changeCandidates}
          initialViewport={reviewViewportRef.current}
          onClose={(reviewViewport) => {
            if (reviewViewport) {
              reviewViewportRef.current = reviewViewport;
            }
            lotImport.closeReview();
            setShowOverlayPanel(true);
            setIsEditingOverlay(true);
            if (reviewViewport?.isCustomView && map && overlayBounds && lotImport.draft) {
              const target = calculateMapViewportFromReview(
                reviewViewport,
                lotImport.draft,
                overlayBounds,
                overlayRotation,
                map
              );
              if (target && target.center && Number.isFinite(target.zoom)) {
                map.setView(target.center, target.zoom, { animate: false });
                map.invalidateSize({ animate: false });
              }
            }
          }}
          onImport={async () => {
            await lotImport.importLots(async () => {
              await handleLotUpdated();
              setShowOverlayPanel(false);
              setIsEditingOverlay(false);
            });
            setShowOverlayPanel(false);
            setIsEditingOverlay(false);
          }}
          isImporting={lotImport.isImporting}
          error={lotImport.error}
          sourceName={`${lotImport.draft.sourceName} · Page ${lotImport.draft.pageNumber}`}
          existingLotNumbers={(mapState.mapData?.lots || []).filter((lot) => Number(lot.property_id) === Number(selectedProperty)).map((lot) => lot.lot_number)}
          imageUrl={originalUploadedImageRef.current}
          pageWidth={lotImport.draft.pageWidth}
          pageHeight={lotImport.draft.pageHeight}
          warnings={lotImport.warnings}
          autoFixDuplicates={true}
          autoSelectAll={true}
        />
      )}

      {/* Visual Blueprint Cropping Modal */}
      <BlueprintCropModal
        isOpen={isCropModalOpen}
        imageUrl={originalUploadedImageRef.current || rawOverlayRef.current}
        onApplyCrop={handleApplyCrop}
        onClose={() => setIsCropModalOpen(false)}
      />

      {/* In-App Duplicate Lot Modal */}
      <DuplicateLotModal
        duplicateModalData={duplicateModalData}
        setDuplicateModalData={setDuplicateModalData}
        handleConfirmDuplicateLot={handleConfirmDuplicateLot}
      />

      {/* Road & Map Labels Floating Control */}
      {showAnnotationPanel && (
        <MapAnnotationControl
          annotations={annotations.filter((item) => !item.deleted)}
          activeAnnotationId={activeAnnotationId}
          onSelectAnnotation={(id) => setActiveAnnotationId(id)}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onUpdateAllAnnotations={handleUpdateAllAnnotations}
          onDeleteAnnotation={handleDeleteAnnotation}
          onDeleteAllAnnotations={handleDeleteAllAnnotations}
          onSaveAnnotations={handleSaveAnnotations}
          isSaving={isSavingAnnotations}
          isEditing={isEditingAnnotations}
          onToggleEditing={() => setIsEditingAnnotations((prev) => !prev)}
          onClose={() => setShowAnnotationPanel(false)}
        />
      )}
    </div>
  );
}

export default AdminViewMap;
