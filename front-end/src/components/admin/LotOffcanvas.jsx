import React, { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { exportSingleLotWordDoc } from "../../utils/exportUtils";

const LotOffcanvas = ({
  selectedLot,
  isOpen,
  onClose,
  onLotUpdated,
  allowedStatuses = ["Available", "Pending", "Sold"],
  showCoordinateEdit = false,
  onStartCoordinateEdit,
  isAdmin: isAdminProp,
  propertyName,
  propertyLocation,
}) => {
  const [status, setStatus] = useState(selectedLot?.status || "Available");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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
    if (selectedLot) {
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
        return "border-yellow-500 text-yellow-600 focus:border-yellow-500 focus:ring-yellow-500";
      case "Sold":
        return "border-red-500 text-red-600 focus:border-red-500 focus:ring-red-500";
      default:
        return "border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500";
    }
  };

  const handleSave = async () => {
    if (!selectedLot) return;

    // Validate lot details
    if (!lotNumber.trim() || !areaSqm) {
      setSaveMessage("Lot Number and Area (SQM) are required.");
      return;
    }

    // Validate customer information if status is being set to Pending
    if (status === "Pending") {
      if (!email || !fullName || !contactNumber || !address) {
        setSaveMessage(
          "All customer fields (email, full name, contact number, address) are required when setting status to Pending"
        );
        return;
      }
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      // 1. Update lot details (lot_number, area_sqm) if changed
      const lotNumberChanged = lotNumber.trim() !== selectedLot.lot_number;
      const areaSqmChanged = parseFloat(areaSqm) !== parseFloat(selectedLot.area_sqm);

      if (lotNumberChanged || areaSqmChanged) {
        console.log("Updating lot details:", { lotNumber, areaSqm });
        const detailsResponse = await fetch(
          `${API_BASE_URL}/api/lots/${selectedLot.lot_id}/details`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lot_number: lotNumber,
              area_sqm: areaSqm,
            }),
          }
        );

        if (!detailsResponse.ok) {
          const errorText = await detailsResponse.json().catch(() => ({}));
          throw new Error(errorText.error || "Failed to update lot details");
        }
      }

      // 2. Update lot status with customer information
      console.log("Updating lot status:", {
        lotId: selectedLot.lot_id,
        status,
        email,
        fullName,
        contactNumber,
        address,
      });

      const response = await fetch(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          email,
          fullName,
          contactNumber,
          address,
          paymentMethod: status === "Sold" ? paymentMethod : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      await response.json();

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

  const handleDelete = async () => {
    if (!selectedLot) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete Lot ${selectedLot.lot_number}? This action cannot be undone and will delete all associated transactions and customer records.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    setSaveMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/lots/${selectedLot.lot_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete lot");
      }

      setSaveMessage("Lot deleted successfully!");

      if (onLotUpdated) {
        onLotUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error deleting lot:", error);
      setSaveMessage(error.message || "Failed to delete lot. Please try again.");
    } finally {
      setIsDeleting(false);
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

      {/* Offcanvas Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[10000] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Lot Details</h2>
            <div className="flex items-center gap-2">
              {hasSavedClient && (
                <button
                  type="button"
                  onClick={() =>
                    exportSingleLotWordDoc(
                      selectedLot,
                      propertyName || selectedLot?.property_name,
                      propertyLocation || selectedLot?.location
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  title="Export Microsoft Word (.doc) Quotation"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Word Doc</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-200"
                title="Close"
              >
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-300"
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
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Lot Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lot Number / Label
                </label>
                <input
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
              </div>

              {/* Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Area (SQM)
                </label>
                <input
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
                  {showCoordinateEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onStartCoordinateEdit) {
                          onStartCoordinateEdit(selectedLot);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Adjust lot shape & pins directly on map"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>Edit Shape on Map</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={latitude}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-xs"
                      placeholder="No coordinates set"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Longitude
                    </label>
                    <input
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
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
                              ? "text-yellow-600"
                              : "text-red-600"
                        }
                      >
                        {s}
                      </option>
                    ))}
                </select>
              </div>

              {/* Customer Information — only show for Pending or Sold */}
              {(status === "Pending" || status === "Sold") && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <input
                        type="text"
                        value={fullName}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                        title="Full name cannot be changed while lot is pending"
                      />
                    ) : (
                      <input
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Contact Number
                        </label>
                        <input
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Payment Method
                        </label>
                        <select
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contact Number
                      </label>
                      {status === "Pending" &&
                      selectedLot.status === "Pending" &&
                      contactNumber &&
                      !isAdmin ? (
                        <input
                          type="tel"
                          value={contactNumber}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                          title="Contact number cannot be changed while lot is pending"
                        />
                      ) : (
                        <input
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <div className="relative">
                        <input
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>
                    {status === "Pending" &&
                    selectedLot.status === "Pending" &&
                    email &&
                    !isAdmin ? (
                      <input
                        type="text"
                        value={address}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-sm"
                        title="Address cannot be changed while lot is pending"
                      />
                    ) : (
                      <input
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
                            selectedLot,
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

              <button
                className={`w-full py-2 px-4 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-200 font-medium ${
                  isDeleting ? "cursor-not-allowed opacity-50" : ""
                }`}
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LotOffcanvas;
