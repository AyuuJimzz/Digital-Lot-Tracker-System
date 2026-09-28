import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "../../../config/api";
import { invalidateEstateMutation } from "../../../config/queryClient";
import { showToast } from "../../GlobalToast";
import { checkIsNonSaleable, stripNonSaleableTags } from "./lotOffcanvasUtils";
import { getCurrentUser } from "../../../utils/authStorage";

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeout || 20000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let onExternalAbort = null;
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      throw new DOMException("Aborted", "AbortError");
    }
    onExternalAbort = () => controller.abort();
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (options.signal && onExternalAbort) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

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
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(null);
  const [customSoldOn, setCustomSoldOn] = useState("");

  // Editable Lot Metadata details
  const [lotNumber, setLotNumber] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Form persistence & race condition guards
  const dirtyFieldsRef = useRef({});
  const activeLotIdRef = useRef(null);
  const fetchAbortControllerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const pendingActionRef = useRef(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);

  const getHasUnsavedChanges = () => {
    return Boolean(
      dirtyFieldsRef.current &&
      Object.values(dirtyFieldsRef.current).some(Boolean)
    );
  };

  const requestClose = (customAction = null) => {
    // If a save or delete request is currently in-flight, do NOT allow close actions or reset isSaving!
    if (isSaving || isDeletingLot) {
      return;
    }
    if (getHasUnsavedChanges()) {
      pendingActionRef.current = typeof customAction === "function" ? customAction : null;
      setShowUnsavedChangesModal(true);
    } else {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsSaving(false);
      if (typeof customAction === "function") {
        customAction();
      } else {
        onClose();
      }
    }
  };

  const confirmDiscardChanges = () => {
    setShowUnsavedChangesModal(false);
    dirtyFieldsRef.current = {};
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsSaving(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof action === "function") {
      action();
    } else {
      onClose();
    }
  };

  const cancelDiscardChanges = () => {
    setShowUnsavedChangesModal(false);
    pendingActionRef.current = null;
  };

  // Helper to synchronize untouched fields from server response while strictly protecting user-edited dirty fields
  const applyUntouchedFields = useCallback((data) => {
    if (!data) return;

    if (!dirtyFieldsRef.current.status && data.status) {
      setStatus(data.status);
    }

    if (!dirtyFieldsRef.current.isNonSaleable && data.is_non_saleable !== undefined) {
      setIsNonSaleable(Number(data.is_non_saleable) === 1);
    }

    if (!dirtyFieldsRef.current.lotNumber && data.lot_number !== undefined && data.lot_number !== "") {
      setLotNumber(data.lot_number);
    }

    if (!dirtyFieldsRef.current.areaSqm && data.area_sqm !== undefined && data.area_sqm !== "") {
      setAreaSqm(data.area_sqm);
    }

    if (!dirtyFieldsRef.current.agentName && data.agent_name !== undefined) {
      setAgentName(data.agent_name || "");
    }

    if (!dirtyFieldsRef.current.assignedEmployeeId && data.employee_id !== undefined) {
      setAssignedEmployeeId(data.employee_id);
    }

    if (!dirtyFieldsRef.current.paymentMethod && data.payment_method !== undefined) {
      setPaymentMethod(data.payment_method || "");
    }

    if (data.customer) {
      if (!dirtyFieldsRef.current.email && data.customer.email !== undefined) {
        setEmail(data.customer.email || "");
      }
      if (!dirtyFieldsRef.current.fullName && data.customer.full_name !== undefined) {
        setFullName(data.customer.full_name || "");
      }
      if (!dirtyFieldsRef.current.contactNumber && data.customer.contact_number !== undefined) {
        setContactNumber(data.customer.contact_number || "");
      }
      if (!dirtyFieldsRef.current.address && data.customer.address !== undefined) {
        setAddress(data.customer.address || "");
      }
    }
  }, []);

  // Cleanup timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Field change handlers that mark fields as user-edited (dirty)
  // so background fetches and parent re-renders NEVER overwrite them
  const handleFullNameChange = (val) => {
    dirtyFieldsRef.current.fullName = true;
    setFullName(val);
  };

  const handleEmailChange = (val) => {
    dirtyFieldsRef.current.email = true;
    setEmail(val);
  };

  const handleContactNumberChange = (val) => {
    dirtyFieldsRef.current.contactNumber = true;
    setContactNumber(val);
  };

  const handleAddressChange = (val) => {
    dirtyFieldsRef.current.address = true;
    setAddress(val);
  };

  const handlePaymentMethodChange = (val) => {
    dirtyFieldsRef.current.paymentMethod = true;
    setPaymentMethod(val);
  };

  const handleLotNumberChange = (val) => {
    dirtyFieldsRef.current.lotNumber = true;
    setLotNumber(val);
  };

  const handleAreaSqmChange = (val) => {
    dirtyFieldsRef.current.areaSqm = true;
    setAreaSqm(val);
  };

  const handleCustomSoldOnChange = (val) => {
    dirtyFieldsRef.current.customSoldOn = true;
    setCustomSoldOn(val);
  };

  const handleStatusChange = (newStatusVal) => {
    const nextStatus = typeof newStatusVal === "function" ? newStatusVal(status) : newStatusVal;
    dirtyFieldsRef.current.status = true;
    if (nextStatus !== "Sold") {
      setCustomSoldOn("");
      dirtyFieldsRef.current.customSoldOn = false;
    }
    // When explicitly switching to Available, clear customer details once.
    if (nextStatus === "Available" && status !== "Available") {
      setEmail("");
      setFullName("");
      setContactNumber("");
      setAddress("");
      dirtyFieldsRef.current.email = false;
      dirtyFieldsRef.current.fullName = false;
      dirtyFieldsRef.current.contactNumber = false;
      dirtyFieldsRef.current.address = false;
    }
    setStatus(nextStatus);
  };

  const userRole = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = isAdminProp !== undefined ? isAdminProp : userRole === "admin";

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?.employee_id;
  const reservingEmployeeId = selectedLot?.customer?.employee_id || selectedLot?.employee_id;
  const isReservingAgent = isAdmin || Boolean(currentUserId && reservingEmployeeId && Number(currentUserId) === Number(reservingEmployeeId));

  const isExistingSoldLot = selectedLot?.status === "Sold";
  const isPendingLockedForOther = selectedLot?.status === "Pending" && !isReservingAgent;
  const isLockedForUser = !isAdmin && (isExistingSoldLot || isPendingLockedForOther);
  const canCancelReservation = isAdmin || isReservingAgent;
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

  // Clean up any pending fetch on unmount
  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
        fetchAbortControllerRef.current = null;
      }
    };
  }, []);

  const handleCopyCoords = () => {
    if (!latitude || !longitude) return;
    const coordStr = `${latitude}, ${longitude}`;
    navigator.clipboard?.writeText(coordStr);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Sync state whenever selectedLot changes or opens
  useEffect(() => {
    if (!isOpen || !selectedLot) {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
        fetchAbortControllerRef.current = null;
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      activeLotIdRef.current = null;
      dirtyFieldsRef.current = {};
      pendingActionRef.current = null;
      setShowUnsavedChangesModal(false);
      setIsSaving(false);
      return;
    }

    const currentLotId = selectedLot.lot_id ?? selectedLot.id;

    // Guard: If drawer is already open for this exact lot,
    // do NOT re-initialize form state.
    // Sync all fresh untouched fields from parent/remote update.
    if (activeLotIdRef.current === currentLotId) {
      applyUntouchedFields(selectedLot);
      return;
    }

    // Fresh lot load: cancel any previous in-flight fetch
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
      fetchAbortControllerRef.current = null;
    }

    activeLotIdRef.current = currentLotId;
    dirtyFieldsRef.current = {};

    setIsEditMenuOpen(false);
    setCopiedCoords(false);
    setLotPendingDelete(null);
    setDeleteLotError("");
    setIsDeletingLot(false);
    setValidationErrors({});
    const nonSaleableInitial =
      selectedLot.is_non_saleable !== undefined && selectedLot.is_non_saleable !== null
        ? Number(selectedLot.is_non_saleable) === 1
        : checkIsNonSaleable(selectedLot.lot_number, selectedLot.area_sqm);
    setIsNonSaleable(Boolean(nonSaleableInitial));
    setStatus(selectedLot.status || "Available");
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
          const firstCoord = coords[0];
          if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
            setLatitude(firstCoord[0]?.toString() || "");
            setLongitude(firstCoord[1]?.toString() || "");
          } else if (typeof firstCoord === "number" && coords.length >= 2) {
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

    // Initialize assigned agent name & ID
    setAgentName(selectedLot.agent_name || (selectedLot.employee_id ? "Agent" : "Admin"));
    setAssignedEmployeeId(selectedLot.employee_id ?? selectedLot.customer?.employee_id ?? null);
    setCustomSoldOn(selectedLot.sold_on ? String(selectedLot.sold_on).slice(0, 10) : "");

    // Fetch latest lot details from server
    if (currentLotId) {
      const abortController = new AbortController();
      fetchAbortControllerRef.current = abortController;
      const targetLotId = currentLotId;

      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken");

      fetchWithTimeout(`${API_BASE_URL}/api/lots/${targetLotId}`, {
        signal: abortController.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((details) => {
          // Guard: ignore stale response if drawer closed, lot changed, or aborted
          if (!details || abortController.signal.aborted || activeLotIdRef.current !== targetLotId) {
            return;
          }

          // Apply untouched fields while preserving all user-edited fields
          applyUntouchedFields(details);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("Failed to fetch fresh lot details in LotOffcanvas:", err);
          }
        });
    }
  }, [selectedLot, isOpen, applyUntouchedFields]);

  const handleSetSaleable = () => {
    setIsNonSaleable(false);
    dirtyFieldsRef.current.isNonSaleable = true;
    const cleaned = stripNonSaleableTags(lotNumber);
    dirtyFieldsRef.current.lotNumber = true;
    setLotNumber(cleaned);
    const nextStatus = status === "NonSaleable" ? "Available" : (status || "Available");
    dirtyFieldsRef.current.status = true;
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
    dirtyFieldsRef.current.isNonSaleable = true;
    let newName = lotNumber.trim();
    if (!checkIsNonSaleable(newName)) {
      newName = `${stripNonSaleableTags(newName)} (Non-Saleable)`.trim();
      dirtyFieldsRef.current.lotNumber = true;
      setLotNumber(newName);
    }
    dirtyFieldsRef.current.status = true;
    setStatus("Available");
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

    // Existing legacy Sold lots may have incomplete buyer records; a date-only audit must remain possible.
    const isEditingCustomer = ["fullName", "contactNumber", "email", "address"]
      .some((field) => dirtyFieldsRef.current[field]);
    const requiresCustomerDetails = status === "Pending" ||
      (status === "Sold" && (selectedLot.status !== "Sold" || isEditingCustomer));
    if (!isNonSaleable && requiresCustomerDetails) {
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
    setIsEditMenuOpen(false);

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
        const detailsResponse = await fetchWithTimeout(
          `${API_BASE_URL}/api/lots/${selectedLot.lot_id}/details`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify({
              lot_number: finalLotNumber,
              area_sqm: areaSqm,
              is_non_saleable: isNonSaleable ? 1 : 0,
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
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}/status`, {
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
          assigned_employee_id: isAdmin && status === "Pending" ? assignedEmployeeId : undefined,
          sold_on: !isNonSaleable && finalStatus === "Sold" && dirtyFieldsRef.current.customSoldOn && customSoldOn
            ? customSoldOn
            : undefined,
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
      invalidateEstateMutation(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}/status`);

      // Synchronize in-memory selectedLot object
      if (selectedLot) {
        if (isAdmin) {
          selectedLot.lot_number = finalLotNumber;
          selectedLot.area_sqm = areaSqm;
        }
        selectedLot.status = finalStatus;
        selectedLot.is_non_saleable = isNonSaleable ? 1 : 0;
        selectedLot._nonSaleable = isNonSaleable;
      }

      // Clear dirty tracking on successful save
      dirtyFieldsRef.current = {};

      showToast("Lot saved successfully!", "success");

      if (onLotUpdated) {
        onLotUpdated();
      }

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("Error saving lot:", error);
      const errMsg = error.name === "AbortError"
        ? "Connection timed out. Please try again."
        : error.message || "Failed to save lot. Please try again.";
      showToast(errMsg, "error");
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
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/lots/${lotToDelete.lot_id}`, {
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
      invalidateEstateMutation(`${API_BASE_URL}/api/lots/${lotToDelete.lot_id}`);
      setLotPendingDelete(null);

      if (onLotUpdated) {
        onLotUpdated();
      }

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setIsDeletingLot(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error deleting lot:", error);
      const errorMsg = error.name === "AbortError"
        ? "Connection timed out. Please try again."
        : error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to delete lot. Please try again.";
      setDeleteLotError(errorMsg);
      showToast(errorMsg, "error");
      setIsDeletingLot(false);
    }
  };

  return {
    status,
    setStatus: handleStatusChange,
    isNonSaleable,
    isEditMenuOpen,
    setIsEditMenuOpen,
    copiedCoords,
    editMenuRef,
    email,
    setEmail: handleEmailChange,
    fullName,
    setFullName: handleFullNameChange,
    contactNumber,
    setContactNumber: handleContactNumberChange,
    address,
    setAddress: handleAddressChange,
    paymentMethod,
    setPaymentMethod: handlePaymentMethodChange,
    isSaving,
    lotPendingDelete,
    isDeletingLot,
    deleteLotError,
    isDeleting,
    agentName,
    lotNumber,
    setLotNumber: handleLotNumberChange,
    areaSqm,
    setAreaSqm: handleAreaSqmChange,
    latitude,
    longitude,
    validationErrors,
    setValidationErrors,
    isAdmin,
    isLockedForUser,
    canCancelReservation,
    assignedEmployeeId,
    setAssignedEmployeeId,
    customSoldOn,
    setCustomSoldOn: handleCustomSoldOnChange,
    hasSavedClient,
    handleCopyCoords,
    handleSetSaleable,
    handleSetNonSaleable,
    handleSave,
    openDeleteModal,
    closeDeleteModal,
    confirmDeleteLot,
    requestClose,
    showUnsavedChangesModal,
    confirmDiscardChanges,
    cancelDiscardChanges,
    getHasUnsavedChanges,
  };
}

export default useLotOffcanvasState;
