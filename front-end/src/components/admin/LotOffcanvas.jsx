import React, { useState, useEffect, useRef } from "react";
import { FileText, Copy, Edit3, ChevronDown, MapPin, Check, AlertTriangle, Trash2, X } from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { exportSingleLotWordDoc } from "../../utils/exportUtils";

const checkIsNonSaleable = (num = "", area = 0) => {
  const text = String(num || "").toLowerCase().trim();
  return (
    text.includes("park") ||
    text.includes("playground") ||
    text.includes("facility") ||
    text.includes("clubhouse") ||
    text.includes("excluded") ||
    text.includes("open space") ||
    text.includes("easement") ||
    text.includes("community") ||
    text.includes("p & pg") ||
    text.includes("amenity") ||
    text.includes("common") ||
    text.includes("non-saleable") ||
    text.includes("non saleable")
  );
};

const stripNonSaleableTags = (numStr) => {
  return String(numStr || "")
    .replace(
      /\s*\([^)]*(?:park|playground|facility|clubhouse|excluded|open\s*space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s*saleable)[^)]*\)/gi,
      ""
    )
    .replace(
      /\s+(?:park|playground|facility|clubhouse|excluded\s*area|open\s*space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s*saleable)\b/gi,
      ""
    )
    .trim();
};

const LotOffcanvas = ({
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
  const [status, setStatus] = useState(selectedLot?.status || "Available");
  const [isNonSaleable, setIsNonSaleable] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const editMenuRef = useRef(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isSaving, setIsSaving] = useState(false);
  const [lotPendingDelete, setLotPendingDelete] = useState(null);
  const [isDeletingLot, setIsDeletingLot] = useState(false);
  const [deleteLotError, setDeleteLotError] = useState("");
  const isDeleting = isDeletingLot;
  const [saveMessage, setSaveMessage] = useState("");
  const [agentName, setAgentName] = useState("Admin");

  // Editable Lot Metadata details
  const [lotNumber, setLotNumber] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const userRole = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = isAdminProp !== undefined ? isAdminProp : userRole === "admin";
  const isExistingSoldLot = selectedLot?.status === "Sold";
  const isLockedForUser = !isAdmin && isExistingSoldLot;
  const hasSavedClient = Boolean(
    (selectedLot?.status === "Pending" || selectedLot?.status === "Sold") &&
    selectedLot?.customer &&
    selectedLot.customer.full_name &&
    selectedLot.customer.full_name.trim() !== ""
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editMenuRef.current && !editMenuRef.current.contains(event.target)) {
        setIsEditMenuOpen(false);
      }
    };
    if (isEditMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditMenuOpen]);

  const handleCopyCoords = () => {
    if (!latitude || !longitude) return;
    const coordStr = `${latitude}, ${longitude}`;
    navigator.clipboard?.writeText(coordStr);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  useEffect(() => {
    if (selectedLot) {
      setIsEditMenuOpen(false);
      setCopiedCoords(false);
      setLotPendingDelete(null);
      setDeleteLotError("");
      setIsDeletingLot(false);
      const nonSaleableInitial =
        checkIsNonSaleable(selectedLot.lot_number, selectedLot.area_sqm) ||
        selectedLot.is_non_saleable === 1 ||
        selectedLot.is_non_saleable === true ||
        selectedLot.status === "NonSaleable";
      setIsNonSaleable(Boolean(nonSaleableInitial));
      setStatus(selectedLot.status);
      setLotNumber(selectedLot.lot_number || "");
      setAreaSqm(selectedLot.area_sqm || "");

      // Parse coordinates to extract latitude and longitude
      if (selectedLot.coordinates) {
        try {
          const coords =
            typeof selectedLot.coordinates === "string"
              ? JSON.parse(selectedLot.coordinates)
              : selectedLot.coordinates;

          if (Array.isArray(coords) && coords.length > 0) {
            // Get the first coordinate pair (for polygon, this is the first point)
            const firstCoord = coords[0];
            if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
              setLatitude(firstCoord[0]?.toString() || "");
              setLongitude(firstCoord[1]?.toString() || "");
            } else if (typeof firstCoord === "number" && coords.length >= 2) {
              // Single coordinate format [lat, lng]
              setLatitude(coords[0]?.toString() || "");
              setLongitude(coords[1]?.toString() || "");
            }
          }
        } catch (error) {
          console.error("Error parsing coordinates:", error);
          setLatitude("");
          setLongitude("");
        }
      } else {
        setLatitude("");
        setLongitude("");
      }

      // If lot has customer data, set the customer information
      if (selectedLot.customer) {
        setEmail(selectedLot.customer.email || "");
        setFullName(selectedLot.customer.full_name || "");
        setContactNumber(selectedLot.customer.contact_number || "");
        setAddress(selectedLot.customer.address || "");
      } else {
        // Clear fields if no customer data
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      }

      // Set payment method if lot is sold and has payment method data
      if (selectedLot.status === "Sold" && selectedLot.payment_method) {
        setPaymentMethod(selectedLot.payment_method);
      } else {
        setPaymentMethod("Cash"); // Default to Cash for non-sold lots or lots without payment method
      }

      // Initialize assigned agent name
      setAgentName(selectedLot.agent_name || (selectedLot.employee_id ? "Agent" : "Admin"));

      // Fetch latest lot details (including persistent agent_name & payment_method)
      if (selectedLot?.lot_id && (selectedLot.status === "Pending" || selectedLot.status === "Sold")) {
        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("authToken");
        fetch(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((details) => {
            if (!details) return;
            if (details.agent_name) {
              setAgentName(details.agent_name);
            }
            if (details.payment_method) {
              setPaymentMethod(details.payment_method);
            }
            if (details.customer) {
              setEmail(details.customer.email || "");
              setFullName(details.customer.full_name || "");
              setContactNumber(details.customer.contact_number || "");
              setAddress(details.customer.address || "");
            }
          })
          .catch((err) => console.warn("Failed to fetch fresh lot details in LotOffcanvas:", err));
      }

      setSaveMessage("");
    }
  }, [selectedLot]);

  // Handle status change to clear fields when going back to Available or when changing from Available to Pending
  useEffect(() => {
    if (selectedLot) {
      // Clear fields if status was changed to Available (not initial load)
      if (status === "Available" && selectedLot.status !== "Available") {
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      }
      // Clear fields if changing from Available to Pending (new customer)
      else if (status === "Pending" && selectedLot.status === "Available") {
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      }
    }
  }, [status, selectedLot]);

  const getStatusColorClasses = (status) => {
    switch (status) {
      case "Available":
        return "border-green-500 text-green-600 focus:border-green-500 focus:ring-green-500";
      case "Pending":
        return "border-amber-500 text-amber-500 focus:border-amber-500 focus:ring-amber-500";
      case "Sold":
        return "border-red-500 text-red-600 focus:border-red-500 focus:ring-red-500";
      default:
        return "border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500";
    }
  };

  const handleSetSaleable = () => {
    setIsNonSaleable(false);
    const cleaned = stripNonSaleableTags(lotNumber);
    setLotNumber(cleaned);
    const nextStatus = status === "NonSaleable" ? "Available" : (status || "Available");
    setStatus(nextStatus);
    if (onLiveLotUpdate && selectedLot) {
      onLiveLotUpdate({
        lot_id: selectedLot.lot_id,
        lot_number: cleaned,
        status: nextStatus,
        is_non_saleable: false,
      });
    }
  };

  const handleSetNonSaleable = () => {
    setIsNonSaleable(true);
    let newName = lotNumber.trim();
    if (!checkIsNonSaleable(newName)) {
      newName = `${stripNonSaleableTags(newName)} (Non-Saleable)`.trim();
      setLotNumber(newName);
    }
    if (onLiveLotUpdate && selectedLot) {
      onLiveLotUpdate({
        lot_id: selectedLot.lot_id,
        lot_number: newName,
        status: "Available",
        is_non_saleable: true,
      });
    }
  };

  const handleSave = async () => {
    if (!selectedLot) return;

    // Validate lot details
    if (!lotNumber.trim() || !areaSqm) {
      setSaveMessage("Lot Number and Area (SQM) are required.");
      return;
    }

    // Validate customer information if status is being set to Pending (only if saleable)
    if (!isNonSaleable && status === "Pending") {
      if (!email || !fullName || !contactNumber || !address) {
        setSaveMessage(
          "All customer fields (email, full name, contact number, address) are required when setting status to Pending"
        );
        return;
      }
    }

    setIsSaving(true);
    const getAuthHeaders = () => {
      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken");
      return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    };

    try {
      // 1. Ensure lot number cleanly reflects classification
      let finalLotNumber = lotNumber.trim();
      if (!isNonSaleable) {
        finalLotNumber = stripNonSaleableTags(finalLotNumber);
      } else if (!checkIsNonSaleable(finalLotNumber)) {
        finalLotNumber = `${stripNonSaleableTags(finalLotNumber)} (Non-Saleable)`.trim();
      }

      // Always persist lot details (lot_number, area_sqm) on save to ensure MySQL is in sync
      console.log("Updating lot details:", { lotNumber: finalLotNumber, areaSqm });
      const detailsResponse = await fetch(
        `${API_BASE_URL}/api/lots/${selectedLot.lot_id}/details`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            lot_number: finalLotNumber,
            area_sqm: areaSqm,
          }),
        }
      );

      if (!detailsResponse.ok) {
        const errorText = await detailsResponse.json().catch(() => ({}));
        throw new Error(errorText.error || errorText.message || "Failed to update lot details");
      }

      // 2. Update lot status with customer information
      console.log("Updating lot status:", {
        lotId: selectedLot.lot_id,
        status: isNonSaleable ? "Available" : status,
        email: isNonSaleable ? null : email,
        fullName: isNonSaleable ? null : fullName,
        contactNumber: isNonSaleable ? null : contactNumber,
        address: isNonSaleable ? null : address,
      });

      const finalStatus = isNonSaleable ? "Available" : status;
      const response = await fetch(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          status: finalStatus,
          email: isNonSaleable ? null : email,
          fullName: isNonSaleable ? null : fullName,
          contactNumber: isNonSaleable ? null : contactNumber,
          address: isNonSaleable ? null : address,
          paymentMethod: !isNonSaleable && status === "Sold" ? paymentMethod : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed.message || parsed.error || errorText;
        } catch (e) {}
        throw new Error(parsedMessage || `HTTP error! status: ${response.status}`);
      }

      await response.json();

      // Synchronize in-memory selectedLot object
      if (selectedLot) {
        selectedLot.lot_number = finalLotNumber;
        selectedLot.status = finalStatus;
        selectedLot.area_sqm = areaSqm;
      }

      setSaveMessage("Lot saved successfully!");

      if (onLotUpdated) {
        onLotUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving lot:", error);
      setSaveMessage(error.message || "Failed to save lot. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (lot) => {
    const targetLot = (lot && typeof lot === "object" && lot.lot_id) ? lot : selectedLot;
    if (!targetLot || !targetLot.lot_id) return;
    setDeleteLotError("");
    setLotPendingDelete(targetLot);
  };

  const closeDeleteModal = () => {
    if (isDeletingLot) return;
    setLotPendingDelete(null);
    setDeleteLotError("");
  };

  const confirmDeleteLot = async () => {
    const lotToDelete = (lotPendingDelete && lotPendingDelete.lot_id) ? lotPendingDelete : selectedLot;
    if (!lotToDelete || !lotToDelete.lot_id || isDeletingLot) return;

    setIsDeletingLot(true);
    setDeleteLotError("");
    setSaveMessage("");

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/api/lots/${lotToDelete.lot_id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed.message || parsed.error || errorText;
        } catch (e) {}
        throw new Error(parsedMessage || "Failed to delete lot");
      }

      setSaveMessage("Lot deleted successfully!");
      setLotPendingDelete(null);

      if (onLotUpdated) {
        onLotUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error deleting lot:", error);
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to delete lot. Please try again.";
      setDeleteLotError(errorMsg);
      setSaveMessage(errorMsg);
    } finally {
      setIsDeletingLot(false);
    }
  };

  if (!isOpen || !selectedLot) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[9999] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* ── In-App Delete Confirmation Modal ── */}
      {lotPendingDelete && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[10002] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lot-modal-title"
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-lot-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                    Delete Lot?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Permanent deletion confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingLot}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lot Details */}
            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-gray-100 dark:border-slate-700/60 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Lot:
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[240px]">
                  {lotPendingDelete.lot_number || `Lot #${lotPendingDelete.lot_id}`}
                </span>
              </div>
              {(propertyName || lotPendingDelete.property_name || selectedLot?.property_name) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Property:
                  </span>
                  <span className="font-medium text-gray-600 dark:text-slate-300 text-right truncate max-w-[240px]">
                    {propertyName || lotPendingDelete.property_name || selectedLot?.property_name}
                  </span>
                </div>
              )}
            </div>

            {/* Warning Message */}
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 mb-4 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                Warning
              </p>
              <p>
                Deleting this lot is permanent and may affect records associated with this lot.
              </p>
              <p className="mt-1 font-semibold text-rose-800 dark:text-rose-200">
                This action cannot be undone.
              </p>
            </div>

            {/* Error Message inside Modal */}
            {deleteLotError && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-xs mb-4">
                <span className="font-bold">Error: </span>
                {deleteLotError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingLot}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteLot}
                disabled={isDeletingLot}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
                  isDeletingLot
                    ? "bg-rose-400 dark:bg-rose-600/70 cursor-not-allowed"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                }`}
              >
                {isDeletingLot ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Lot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offcanvas Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[10000] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Lot Details</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors duration-200"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="space-y-4">
              {/* Lot Number */}
              <div>
                <label
                  htmlFor="lot-offcanvas-lot-number"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Lot Number / Label
                </label>
                <input
                  id="lot-offcanvas-lot-number"
                  name="lot_number"
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  disabled={!isAdmin}
                  readOnly={!isAdmin}
                  title={!isAdmin ? "Only Admins can edit lot number" : ""}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 font-semibold ${
                    !isAdmin ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""
                  }`}
                  placeholder="e.g. BLOCK 7 Lot 1"
                />
                {!isNonSaleable && checkIsNonSaleable(lotNumber) && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleaned = stripNonSaleableTags(lotNumber);
                      setLotNumber(cleaned);
                      if (onLiveLotUpdate && selectedLot) {
                        onLiveLotUpdate({
                          lot_id: selectedLot.lot_id,
                          lot_number: cleaned,
                          status: status || "Available",
                          is_non_saleable: false,
                        });
                      }
                    }}
                    className="mt-1 text-left text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    ✨ Click to remove non-saleable tag from name
                  </button>
                )}
              </div>

              {/* Area */}
              <div>
                <label
                  htmlFor="lot-offcanvas-area"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Area (SQM)
                </label>
                <input
                  id="lot-offcanvas-area"
                  name="area_sqm"
                  type="number"
                  step="0.01"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(e.target.value)}
                  disabled={!isAdmin}
                  readOnly={!isAdmin}
                  title={!isAdmin ? "Only Admins can edit lot area" : ""}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                    !isAdmin ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""
                  }`}
                  placeholder="e.g. 200"
                />
              </div>

              {/* Latitude and Longitude */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coordinates
                  </span>
                  <div className="relative" ref={editMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsEditMenuOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 transition-all cursor-pointer shadow-xs"
                      aria-haspopup="true"
                      aria-expanded={isEditMenuOpen}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isEditMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isEditMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-2 z-50 text-xs text-gray-700 dark:text-slate-200">
                        {/* Lot Classification inside Edit menu */}
                        <div className="mb-2">
                          <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                            Lot Classification
                          </span>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={handleSetSaleable}
                              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                !isNonSaleable
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                              } ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
                              Saleable
                            </button>
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={handleSetNonSaleable}
                              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                isNonSaleable
                                  ? "bg-slate-700 text-white shadow-sm ring-1 ring-slate-500/50"
                                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                              } ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                              Non-Saleable
                            </button>
                          </div>
                        </div>

                        <div className="my-1.5 border-t border-gray-100 dark:border-slate-700/80" />

                        {showCoordinateEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditMenuOpen(false);
                              if (onStartCoordinateEdit) {
                                onStartCoordinateEdit(selectedLot);
                              }
                            }}
                            className="w-full px-2.5 py-2 rounded-lg text-left flex items-center gap-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium transition-colors cursor-pointer"
                          >
                            <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
                            <div>
                              <div className="font-semibold">Edit Shape on Map</div>
                              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">Adjust corners & vertices</div>
                            </div>
                          </button>
                        )}

                        <div className="my-1.5 border-t border-gray-100 dark:border-slate-700/80" />

                        <button
                          type="button"
                          onClick={() => {
                            handleCopyCoords();
                          }}
                          className="w-full px-2.5 py-2 rounded-lg text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          {copiedCoords ? (
                            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4 shrink-0 text-gray-400" />
                          )}
                          <div>
                            <div className="font-medium">
                              {copiedCoords ? "Coordinates Copied!" : "Copy Lat / Lng"}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">
                              Copy pin center to clipboard
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="lot-offcanvas-latitude"
                      className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5"
                    >
                      Latitude
                    </label>
                    <input
                      id="lot-offcanvas-latitude"
                      name="latitude"
                      type="text"
                      value={latitude}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-xs"
                      placeholder="No coordinates set"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lot-offcanvas-longitude"
                      className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5"
                    >
                      Longitude
                    </label>
                    <input
                      id="lot-offcanvas-longitude"
                      name="longitude"
                      type="text"
                      value={longitude}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-xs"
                      placeholder="No coordinates set"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              {isNonSaleable ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500 inline-block" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Non-Saleable (Common / Amenity Area)
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded flex items-center gap-1">
                      🔒 Locked
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    Common ground / facility. Cannot be reserved or sold to prevent accidental bookings. Switch to "Saleable Lot" above to unlock selling.
                  </p>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="lot-offcanvas-status"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="lot-offcanvas-status"
                    name="lot_status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isLockedForUser}
                    title={isLockedForUser ? "Only Admins can change status of sold lots" : ""}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${getStatusColorClasses(
                      status
                    )} ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
                  >
                    {["Available", "Pending", "Sold"]
                      .filter((s) => allowedStatuses.includes(s))
                      .map((s) => (
                        <option
                          key={s}
                          value={s}
                          className={
                            s === "Available"
                              ? "text-green-600"
                              : s === "Pending"
                                ? "text-amber-500"
                                : "text-red-600"
                          }
                        >
                          {s}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Customer Information — only show for Saleable lots when Pending or Sold */}
              {!isNonSaleable && (status === "Pending" || status === "Sold") && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="lot-offcanvas-fullname"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Full Name
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <input
                        id="lot-offcanvas-fullname"
                        name="customer_name"
                        type="text"
                        value={fullName}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                        title="Full name cannot be changed while lot is pending"
                      />
                    ) : (
                      <input
                        id="lot-offcanvas-fullname"
                        name="customer_name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLockedForUser}
                        title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                          isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                        }`}
                        placeholder="Enter customer's full name"
                      />
                    )}
                  </div>

                  {status === "Sold" ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="lot-offcanvas-contact-sold"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Contact Number
                        </label>
                        <input
                          id="lot-offcanvas-contact-sold"
                          name="customer_contact"
                          type="tel"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          disabled={isLockedForUser}
                          title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                            isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                          }`}
                          placeholder="Enter contact number"
                        />
                      </div>

                      {/* Payment Method - Only show when status is Sold */}
                      <div>
                        <label
                          htmlFor="lot-offcanvas-payment-method"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Payment Method
                        </label>
                        <select
                          id="lot-offcanvas-payment-method"
                          name="payment_method"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          disabled={isLockedForUser}
                          title={
                            isLockedForUser ? "Only Admins can edit sold lot payment method" : ""
                          }
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                            isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                          }`}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Installment">Installment</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="lot-offcanvas-contact"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Contact Number
                      </label>
                      {status === "Pending" &&
                      selectedLot.status === "Pending" &&
                      contactNumber &&
                      !isAdmin ? (
                        <input
                          id="lot-offcanvas-contact"
                          name="customer_contact"
                          type="tel"
                          value={contactNumber}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                          title="Contact number cannot be changed while lot is pending"
                        />
                      ) : (
                        <input
                          id="lot-offcanvas-contact"
                          name="customer_contact"
                          type="tel"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          disabled={isLockedForUser}
                          title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                            isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                          }`}
                          placeholder="Enter contact number"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="lot-offcanvas-email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Email
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <div className="relative">
                        <input
                          id="lot-offcanvas-email"
                          name="customer_email"
                          type="email"
                          value={email}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                          title="Email cannot be changed while lot is pending"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg
                            className="w-4 h-4 text-gray-400 dark:text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <input
                        id="lot-offcanvas-email"
                        name="customer_email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLockedForUser}
                        title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
                          isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                        }`}
                        placeholder="Enter email address"
                      />
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="lot-offcanvas-address"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Address
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <input
                        id="lot-offcanvas-address"
                        name="customer_address"
                        type="text"
                        value={address}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-sm"
                        title="Address cannot be changed while lot is pending"
                      />
                    ) : (
                      <input
                        id="lot-offcanvas-address"
                        name="customer_address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isLockedForUser}
                        title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white dark:bg-slate-700 ${
                          isLockedForUser ? "cursor-not-allowed opacity-75" : ""
                        }`}
                        placeholder="Enter customer's address"
                      />
                    )}
                  </div>

                  {/* Compact Official Microsoft Word Document Download */}
                  {hasSavedClient && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          exportSingleLotWordDoc(
                            { ...selectedLot, agent_name: agentName },
                            propertyName || selectedLot?.property_name,
                            propertyLocation || selectedLot?.location
                          )
                        }
                        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Export Word Quotation (.doc)</span>
                      </button>
                    </div>
                  )}

                  {status === "Pending" && selectedLot.status === "Pending" && email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Customer information is locked while lot is pending. Change status to
                      Available to modify.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-slate-700">
            {/* Save Message */}
            {saveMessage && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  saveMessage.includes("success")
                    ? "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                    : "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                }`}
              >
                {saveMessage}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                className={`w-full py-2 px-4 rounded-lg transition-colors duration-200 font-medium ${
                  isSaving
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                onClick={handleSave}
                disabled={isSaving || isDeleting}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </button>

              {isAdmin && (
                <button
                  className={`w-full py-2 px-4 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-200 font-medium ${
                    isDeleting ? "cursor-not-allowed opacity-50" : ""
                  }`}
                  onClick={() => openDeleteModal(selectedLot)}
                  disabled={isSaving || isDeletingLot}
                >
                  {isDeleting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-red-600 dark:text-red-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    "Delete Lot"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LotOffcanvas;
