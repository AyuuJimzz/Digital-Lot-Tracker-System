import React from "react";
import { useLotOffcanvasState } from "./lotOffcanvas/useLotOffcanvasState";
import { LotOffcanvasHeader } from "./lotOffcanvas/LotOffcanvasHeader";
import { LotMetadataSection } from "./lotOffcanvas/LotMetadataSection";
import { LotCoordinatesSection } from "./lotOffcanvas/LotCoordinatesSection";
import { LotStatusSection } from "./lotOffcanvas/LotStatusSection";
import { LotCustomerSection } from "./lotOffcanvas/LotCustomerSection";
import { LotOffcanvasFooter } from "./lotOffcanvas/LotOffcanvasFooter";
import { DeleteLotModal } from "./lotOffcanvas/DeleteLotModal";
import { UnsavedChangesModal } from "./lotOffcanvas/UnsavedChangesModal";

export const LotOffcanvas = ({
  selectedLot,
  isOpen,
  onClose,
  onLotUpdated,
  onLiveLotUpdate,
  allowedStatuses = ["Available", "Pending", "Sold"],
  showCoordinateEdit = false,
  onStartCoordinateEdit,
  onDuplicateLot,
  isAdmin: isAdminProp,
  propertyName,
  propertyLocation,
}) => {
  const {
    status,
    setStatus,
    isNonSaleable,
    isEditMenuOpen,
    setIsEditMenuOpen,
    copiedCoords,
    editMenuRef,
    email,
    setEmail,
    fullName,
    setFullName,
    contactNumber,
    setContactNumber,
    address,
    setAddress,
    paymentMethod,
    setPaymentMethod,
    isSaving,
    lotPendingDelete,
    isDeletingLot,
    deleteLotError,
    isDeleting,
    agentName,
    agentStatus,
    assignedEmployeeId,
    lotNumber,
    setLotNumber,
    areaSqm,
    setAreaSqm,
    latitude,
    longitude,
    validationErrors,
    setValidationErrors,
    isAdmin,
    isLockedForUser,
    canCancelReservation,
    hasSavedClient,
    handleCopyCoords,
    handleSetSaleable,
    handleSetNonSaleable,
    handleSave,
    customSoldOn,
    setCustomSoldOn,
    isLegacyUndated,
    setIsLegacyUndated,
    isOldRecord,
    setIsOldRecord,
    openDeleteModal,
    closeDeleteModal,
    confirmDeleteLot,
    requestClose,
    showUnsavedChangesModal,
    confirmDiscardChanges,
    cancelDiscardChanges,
  } = useLotOffcanvasState({
    selectedLot,
    isOpen,
    onClose,
    onLotUpdated,
    onLiveLotUpdate,
    isAdmin: isAdminProp,
  });

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        if (showUnsavedChangesModal) {
          cancelDiscardChanges();
        } else {
          requestClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, requestClose, showUnsavedChangesModal, cancelDiscardChanges]);

  const handleStartCoordinateEdit = (lot) => {
    if (onStartCoordinateEdit) {
      requestClose(() => onStartCoordinateEdit(lot || selectedLot));
    }
  };

  if (!isOpen || !selectedLot) return null;

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[9999] transition-opacity duration-300"
        onClick={requestClose}
      />

      {/* In-App Delete Confirmation Modal */}
      <DeleteLotModal
        lotPendingDelete={lotPendingDelete}
        closeDeleteModal={closeDeleteModal}
        confirmDeleteLot={confirmDeleteLot}
        isDeletingLot={isDeletingLot}
        deleteLotError={deleteLotError}
        propertyName={propertyName}
        selectedLot={selectedLot}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedChangesModal}
        onKeepEditing={cancelDiscardChanges}
        onDiscard={confirmDiscardChanges}
        lotNumber={lotNumber || selectedLot?.lot_number}
      />

      {/* Offcanvas Drawer Panel */}
      <div
        className={`fixed top-0 right-0 z-[10000] h-full w-full max-w-[26rem] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-slate-800 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <LotOffcanvasHeader onClose={requestClose} isSaving={isSaving} />

          {/* Form Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-6">
            <div className="space-y-6">
              <section aria-label="Lot information" className="space-y-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Lot information
                </h3>
                <LotMetadataSection
                  lotNumber={lotNumber}
                  setLotNumber={setLotNumber}
                  areaSqm={areaSqm}
                  setAreaSqm={setAreaSqm}
                  isAdmin={isAdmin}
                  isNonSaleable={isNonSaleable}
                  validationErrors={validationErrors}
                  setValidationErrors={setValidationErrors}
                  onLiveLotUpdate={onLiveLotUpdate}
                  selectedLot={selectedLot}
                  status={status}
                  isSaving={isSaving}
                />

                <LotCoordinatesSection
                  latitude={latitude}
                  longitude={longitude}
                  isAdmin={isAdmin}
                  editMenuRef={editMenuRef}
                  isEditMenuOpen={isEditMenuOpen}
                  setIsEditMenuOpen={setIsEditMenuOpen}
                  isNonSaleable={isNonSaleable}
                  handleSetSaleable={handleSetSaleable}
                  handleSetNonSaleable={handleSetNonSaleable}
                  showCoordinateEdit={showCoordinateEdit}
                  onStartCoordinateEdit={handleStartCoordinateEdit}
                  selectedLot={selectedLot}
                  handleCopyCoords={handleCopyCoords}
                  copiedCoords={copiedCoords}
                  isSaving={isSaving}
                />
              </section>

              <section aria-label="Lot status" className="border-t border-gray-200 pt-5 dark:border-slate-700">
                <LotStatusSection
                  isNonSaleable={isNonSaleable}
                  status={status}
                  setStatus={setStatus}
                  isLockedForUser={isLockedForUser}
                  canCancelReservation={canCancelReservation}
                  allowedStatuses={allowedStatuses}
                  originalStatus={selectedLot.status}
                  pendingSince={selectedLot.pending_since}
                  soldOn={selectedLot.sold_on}
                  customSoldOn={customSoldOn}
                  setCustomSoldOn={setCustomSoldOn}
                  isLegacyUndated={isLegacyUndated}
                  setIsLegacyUndated={setIsLegacyUndated}
                  isOldRecord={isOldRecord}
                  setIsOldRecord={setIsOldRecord}
                  agentName={agentName}
                  assignedEmployeeId={assignedEmployeeId}
                  isAdmin={isAdmin}
                  isSaving={isSaving}
                />
              </section>

              <LotCustomerSection
                isNonSaleable={isNonSaleable}
                status={status}
                selectedLot={selectedLot}
                isAdmin={isAdmin}
                fullName={fullName}
                setFullName={setFullName}
                contactNumber={contactNumber}
                setContactNumber={setContactNumber}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                email={email}
                setEmail={setEmail}
                address={address}
                setAddress={setAddress}
                validationErrors={validationErrors}
                setValidationErrors={setValidationErrors}
                isLockedForUser={isLockedForUser}
                hasSavedClient={hasSavedClient}
                agentName={isOldRecord ? "Old Record" : agentName}
                agentStatus={isOldRecord ? "legacy" : agentStatus}
                isOldRecord={isOldRecord}
                propertyName={propertyName}
                propertyLocation={propertyLocation}
                isSaving={isSaving}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <LotOffcanvasFooter
            isLockedForUser={isLockedForUser}
            isSaving={isSaving}
            isDeleting={isDeleting}
            isDeletingLot={isDeletingLot}
            handleSave={handleSave}
            isAdmin={isAdmin}
            openDeleteModal={openDeleteModal}
            selectedLot={selectedLot}
          />
        </div>
      </div>
    </>
  );
};

export default LotOffcanvas;
