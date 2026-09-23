import React from "react";
import { useLotOffcanvasState } from "./lotOffcanvas/useLotOffcanvasState";
import { LotOffcanvasHeader } from "./lotOffcanvas/LotOffcanvasHeader";
import { LotMetadataSection } from "./lotOffcanvas/LotMetadataSection";
import { LotCoordinatesSection } from "./lotOffcanvas/LotCoordinatesSection";
import { LotStatusSection } from "./lotOffcanvas/LotStatusSection";
import { LotCustomerSection } from "./lotOffcanvas/LotCustomerSection";
import { LotOffcanvasFooter } from "./lotOffcanvas/LotOffcanvasFooter";
import { DeleteLotModal } from "./lotOffcanvas/DeleteLotModal";

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
    hasSavedClient,
    handleCopyCoords,
    handleSetSaleable,
    handleSetNonSaleable,
    handleSave,
    openDeleteModal,
    closeDeleteModal,
    confirmDeleteLot,
  } = useLotOffcanvasState({
    selectedLot,
    isOpen,
    onClose,
    onLotUpdated,
    onLiveLotUpdate,
    isAdmin: isAdminProp,
  });

  if (!isOpen || !selectedLot) return null;

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[9999] transition-opacity duration-300"
        onClick={onClose}
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

      {/* Offcanvas Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[10000] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <LotOffcanvasHeader onClose={onClose} />

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="space-y-4">
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
                onStartCoordinateEdit={onStartCoordinateEdit}
                selectedLot={selectedLot}
                handleCopyCoords={handleCopyCoords}
                copiedCoords={copiedCoords}
              />

              <LotStatusSection
                isNonSaleable={isNonSaleable}
                status={status}
                setStatus={setStatus}
                isLockedForUser={isLockedForUser}
                allowedStatuses={allowedStatuses}
              />

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
                agentName={agentName}
                propertyName={propertyName}
                propertyLocation={propertyLocation}
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
