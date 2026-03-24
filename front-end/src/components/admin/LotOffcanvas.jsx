import React, { useState, useEffect } from "react";
import axios from "axios";

const LotOffcanvas = ({ selectedLot, isOpen, onClose, onLotUpdated, allowedStatuses = ["Available", "Pending", "Sold"] }) => {
  const [status, setStatus] = useState(selectedLot?.status || "Available");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [customerEmail, setCustomerEmail] = useState(""); // Store existing customer email

  // Client dropdown state
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  // Fetch clients when offcanvas opens
  useEffect(() => {
    if (isOpen) {
      axios
        .get("http://localhost:5000/api/clients", { withCredentials: true })
        .then((res) => setClients(Array.isArray(res.data) ? res.data : []))
        .catch(() => setClients([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedLot) {
      setStatus(selectedLot.status);
      setSelectedClientId("");

      // If lot has customer data, set the customer email
      if (selectedLot.customer && selectedLot.customer.email) {
        setCustomerEmail(selectedLot.customer.email);
        setEmail(selectedLot.customer.email);
      } else {
        setCustomerEmail("");
        setEmail("");
      }

      setSaveMessage("");
    }
  }, [selectedLot]);

  // When a client is selected from dropdown, auto-fill email
  const handleClientSelect = (e) => {
    const clientId = e.target.value;
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find((c) => String(c.client_id) === clientId);
      setEmail(client ? client.email : "");
    } else {
      setEmail("");
    }
  };

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

    // Validate email if status is being set to Pending
    if (status === "Pending" && !email) {
      setSaveMessage("Email is required when setting status to Pending");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      // Update lot status with email
      console.log("Updating lot status:", {
        lotId: selectedLot.lot_id,
        status,
        email,
      });

      const response = await fetch(
        `http://localhost:5000/api/lots/${selectedLot.lot_id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status, email }),
        },
      );

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${errorText}`,
        );
      }

      // Response from lot status update (not used, but successful)
      await response.json();

      setSaveMessage("Lot status updated successfully!");

      // Notify parent that lot data has been updated
      if (onLotUpdated) {
        onLotUpdated();
      }

      // Close the offcanvas after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving lot:", error);
      setSaveMessage("Failed to save lot status. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !selectedLot) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[1000] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Offcanvas Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-[1001] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Lot Details</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <svg
                className="w-6 h-6 text-gray-600"
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
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Lot Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot Number
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedLot.lot_number}
                </div>
              </div>

              {/* Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area
                </label>
                <div className="text-lg text-gray-900">
                  {selectedLot.area_sqm} SQM
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${getStatusColorClasses(
                    status,
                  )}`}
                >
                  {["Available", "Pending", "Sold"]
                    .filter((s) => allowedStatuses.includes(s))
                    .map((s) => (
                      <option key={s} value={s} className={
                        s === "Available" ? "text-green-600" :
                        s === "Pending" ? "text-yellow-600" : "text-red-600"
                      }>{s}</option>
                    ))
                  }
                </select>
              </div>

              {/* Client Selection — only show for Pending or Sold */}
              {(status === "Pending" || status === "Sold") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Client
                </label>
                {customerEmail ? (
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      title="Email cannot be changed while lot is pending"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-gray-400"
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
                  <>
                    <select
                      value={selectedClientId}
                      onChange={handleClientSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Select a client --</option>
                      {clients.map((client) => (
                        <option key={client.client_id} value={client.client_id}>
                          {client.full_name} ({client.email})
                        </option>
                      ))}
                    </select>
                    {email && (
                      <p className="mt-1 text-xs text-gray-500">
                        Email: <span className="font-medium">{email}</span>
                      </p>
                    )}
                    {clients.length === 0 && (
                      <p className="mt-1 text-xs text-yellow-600">
                        No clients found. Add clients first via My Clients page.
                      </p>
                    )}
                  </>
                )}
                {customerEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    Email is locked while lot is pending. Change status to
                    Available to modify.
                  </p>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            {/* Save Message */}
            {saveMessage && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  saveMessage.includes("success")
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-red-100 text-red-700 border border-red-200"
                }`}
              >
                {saveMessage}
              </div>
            )}

            <button
              className={`w-full py-2 px-4 rounded-lg transition-colors duration-200 font-medium ${
                isSaving
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              onClick={handleSave}
              disabled={isSaving}
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
          </div>
        </div>
      </div>
    </>
  );
};

export default LotOffcanvas;
