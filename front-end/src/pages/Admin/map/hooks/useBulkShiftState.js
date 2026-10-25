import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config/api";

export function useBulkShiftState({
  selectedProperty,
  annotations,
  setAnnotations,
  handleLotUpdated,
}) {
  const [isBulkShifting, setIsBulkShifting] = useState(false);
  const [bulkShiftOffset, setBulkShiftOffset] = useState({ lat: 0, lng: 0 });
  const [pendingBulkShift, setPendingBulkShift] = useState(false);
  const [isBulkShiftSubmitting, setIsBulkShiftSubmitting] = useState(false);
  const [bulkShiftError, setBulkShiftError] = useState("");
  const [bulkShiftSuccessMessage, setBulkShiftSuccessMessage] = useState("");

  // Listen for openMoveAllLots event from AdminHeader Manage Lots
  useEffect(() => {
    const handleOpenMoveAllLotsEvent = () => {
      setIsBulkShifting((prev) => {
        const next = !prev;
        if (next) {
          window.dispatchEvent(new CustomEvent("closeBlockAdjustPanel"));
          window.dispatchEvent(new CustomEvent("closeQuickAddLot"));
          window.dispatchEvent(new CustomEvent("closeAnnotationPanel"));
        }
        return next;
      });
      setBulkShiftOffset({ lat: 0, lng: 0 });
    };
    window.addEventListener("openMoveAllLots", handleOpenMoveAllLotsEvent);
    return () =>
      window.removeEventListener("openMoveAllLots", handleOpenMoveAllLotsEvent);
  }, []);

  // Listen for toggleBulkShiftLots event from AdminHeader
  useEffect(() => {
    const handleToggleBulkShift = () => {
      setIsBulkShifting((prev) => {
        const next = !prev;
        if (next) {
          window.dispatchEvent(new CustomEvent("closeBlockAdjustPanel"));
          window.dispatchEvent(new CustomEvent("closeQuickAddLot"));
          window.dispatchEvent(new CustomEvent("closeAnnotationPanel"));
        }
        return next;
      });
      setBulkShiftOffset({ lat: 0, lng: 0 });
    };
    window.addEventListener("toggleBulkShiftLots", handleToggleBulkShift);
    return () =>
      window.removeEventListener("toggleBulkShiftLots", handleToggleBulkShift);
  }, []);

  // Listen for closeBulkShift event
  useEffect(() => {
    const handleClose = () => setIsBulkShifting(false);
    window.addEventListener("closeBulkShift", handleClose);
    return () => window.removeEventListener("closeBulkShift", handleClose);
  }, []);

  // Save bulk shifted coordinates to database (opens in-app confirmation modal)
  const handleOpenBulkShiftConfirm = () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setIsBulkShifting(false);
      return;
    }
    setBulkShiftError("");
    setPendingBulkShift(true);
  };

  const handleCloseBulkShiftConfirm = () => {
    if (isBulkShiftSubmitting) return;
    setPendingBulkShift(false);
    setBulkShiftError("");
  };

  const confirmBulkShift = async () => {
    if (bulkShiftOffset.lat === 0 && bulkShiftOffset.lng === 0) {
      setPendingBulkShift(false);
      setIsBulkShifting(false);
      return;
    }

    setIsBulkShiftSubmitting(true);
    setBulkShiftError("");

    try {
      await axios.put(`${API_BASE_URL}/api/lots/property/${selectedProperty}/bulk-shift`, {
        deltaLat: bulkShiftOffset.lat,
        deltaLng: bulkShiftOffset.lng,
      });

      // Shift local annotations state as well so UI updates immediately
      if (annotations && annotations.length > 0) {
        setAnnotations((prev) =>
          prev.map((a) =>
            typeof a.lat === "number" && typeof a.lng === "number"
              ? { ...a, lat: a.lat + bulkShiftOffset.lat, lng: a.lng + bulkShiftOffset.lng }
              : a
          )
        );
      }

      setPendingBulkShift(false);
      setBulkShiftSuccessMessage("All lots and road labels have been moved and saved successfully!");
      setTimeout(() => setBulkShiftSuccessMessage(""), 4000);

      // Reload map data to get fresh coordinates from database
      if (handleLotUpdated) {
        await handleLotUpdated();
      }
      setIsBulkShifting(false);
      setBulkShiftOffset({ lat: 0, lng: 0 });
    } catch (err) {
      console.error("Error bulk shifting lots and road labels:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to bulk shift lots";
      setBulkShiftError(errorMsg);
    } finally {
      setIsBulkShiftSubmitting(false);
    }
  };

  const handleSaveBulkShift = handleOpenBulkShiftConfirm;

  return {
    isBulkShifting,
    setIsBulkShifting,
    bulkShiftOffset,
    setBulkShiftOffset,
    pendingBulkShift,
    setPendingBulkShift,
    isBulkShiftSubmitting,
    setIsBulkShiftSubmitting,
    bulkShiftError,
    setBulkShiftError,
    bulkShiftSuccessMessage,
    setBulkShiftSuccessMessage,
    handleOpenBulkShiftConfirm,
    handleCloseBulkShiftConfirm,
    confirmBulkShift,
    handleSaveBulkShift,
  };
}

export default useBulkShiftState;
