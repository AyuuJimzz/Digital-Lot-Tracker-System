import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../../../config/api";
import { showToast } from "../../GlobalToast";
import { checkIsNonSaleable, stripNonSaleableTags } from "./lotOffcanvasUtils";

export function useLotOffcanvasState({
  selectedLot,
  isOpen,
  onClose,
  onLotUpdated,
  onLiveLotUpdate,
  isAdmin: isAdminProp,
}) {
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
  const [agentName, setAgentName] = useState("Admin");

  // Editable Lot Metadata details
  const [lotNumber, setLotNumber] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

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

  // Close edit dropdown menu when clicking outside
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

  // Sync state whenever selectedLot changes or opens
  useEffect(() => {
    if (selectedLot) {
      setIsEditMenuOpen(false);
      setCopiedCoords(false);
      setLotPendingDelete(null);
      setDeleteLotError("");
      setIsDeletingLot(false);
      setValidationErrors({});
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
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      }

      // Set payment method if lot is sold and has payment method data
      if (selectedLot.status === "Sold" && selectedLot.payment_method) {
        setPaymentMethod(selectedLot.payment_method);
      } else {
        setPaymentMethod("Cash");
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
    }
  }, [selectedLot]);

  // Handle status change to clear fields when going back to Available or when changing from Available to Pending
  useEffect(() => {
    if (selectedLot) {
      if (status === "Available" && selectedLot.status !== "Available") {
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      } else if (status === "Pending" && selectedLot.status === "Available") {
        setEmail("");
        setFullName("");
        setContactNumber("");
        setAddress("");
      }
    }
  }, [status, selectedLot]);

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
      const errors = {};
      if (!lotNumber.trim()) errors.lotNumber = true;
      if (!areaSqm) errors.areaSqm = true;
      setValidationErrors(errors);
      showToast("Lot Number and Area (SQM) are required.", "error");
      return;
    }

    // Validate customer information if status is being set to Pending or Sold (only if saleable)
    if (!isNonSaleable && (status === "Pending" || status === "Sold")) {
      const errors = {};
      if (!fullName?.trim()) errors.fullName = true;
      if (!contactNumber?.trim()) errors.contactNumber = true;
      if (!email?.trim()) errors.email = true;
      if (!address?.trim()) errors.address = true;

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        showToast(
          `All customer fields (full name, contact number, email, address) are required when setting status to ${status}.`,
          "error"
        );
        return;
      }
    }

    setValidationErrors({});
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
      let finalLotNumber = lotNumber.trim();
      if (!isNonSaleable) {
        finalLotNumber = stripNonSaleableTags(finalLotNumber);
      } else if (!checkIsNonSaleable(finalLotNumber)) {
        finalLotNumber = `${stripNonSaleableTags(finalLotNumber)} (Non-Saleable)`.trim();
      }

      // Only Admins can modify core lot metadata (lot_number, area_sqm)
      if (isAdmin) {
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
      }

      // 2. Update lot status with customer information
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
        if (isAdmin) {
          selectedLot.lot_number = finalLotNumber;
          selectedLot.area_sqm = areaSqm;
        }
        selectedLot.status = finalStatus;
      }

      showToast("Lot saved successfully!", "success");

      if (onLotUpdated) {
        onLotUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving lot:", error);
      const errMsg = error.message || "Failed to save lot. Please try again.";
      showToast(errMsg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (lot) => {
    const targetLot = lot && typeof lot === "object" && lot.lot_id ? lot : selectedLot;
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
    if (!isAdmin) return;
    const lotToDelete = lotPendingDelete && lotPendingDelete.lot_id ? lotPendingDelete : selectedLot;
    if (!lotToDelete || !lotToDelete.lot_id || isDeletingLot) return;

    setIsDeletingLot(true);
    setDeleteLotError("");

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

      showToast("Lot deleted successfully!", "success");
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
      showToast(errorMsg, "error");
    } finally {
      setIsDeletingLot(false);
    }
  };

  return {
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
  };
}

export default useLotOffcanvasState;
