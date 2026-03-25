import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  MapContainer, TileLayer, Polygon, Polyline,
  Marker, Tooltip, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ROWS_PER_PAGE = 10;
const EMPTY_FORM = { full_name: "", contact_number: "", email: "", address: "" };

// Fix gray map on first load
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Same status colors as admin LotsMap
const getStatusColor = (status) => {
  switch (status) {
    case "Available": return "#22c55e";
    case "Pending":   return "#eab308";
    case "Sold":      return "#ef4444";
    default:          return "#94a3b8";
  }
};

// Same pin icon as admin LotsMap
const createPinIcon = (status, isSelected = false) => {
  const color = isSelected ? "#2563eb" : getStatusColor(status);
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="
      background-color: ${color};
      width: ${isSelected ? 20 : 16}px;
      height: ${isSelected ? 20 : 16}px;
      border-radius: 50%;
      border: ${isSelected ? "3px" : "1px"} solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      cursor: pointer;
    "></div>`,
    iconSize: [isSelected ? 20 : 16, isSelected ? 20 : 16],
    iconAnchor: [isSelected ? 10 : 8, isSelected ? 10 : 8],
  });
};

const MyClients = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Add Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = info, 2 = lot selection
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lot selection state
  const [mapLots, setMapLots] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);

  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalStep, setEditModalStep] = useState(1);
  const [editingClient, setEditingClient] = useState(null);
  const [editFormData, setEditFormData] = useState(EMPTY_FORM);
  const [editSelectedLot, setEditSelectedLot] = useState(null); // null = no change, false = remove
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await axios.get(
          "http://localhost:5000/api/auth/check-session",
          { withCredentials: true }
        );
        const role = sessionRes.data.role;
        if (role !== "employee" && role !== "admin") { window.location.href = "/forbidden"; return; }
        setIsAuthorized(true);
        await fetchClients();
      } catch (err) {
        if (err?.response?.status === 401) { window.location.href = "/access-denied"; return; }
        setError("Unable to load client data. Please refresh and try again.");
      } finally { setLoading(false); }
    };
    init();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/clients", { withCredentials: true });
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch { setClients([]); }
  };

  const fetchMapLots = async (mode = "add") => {
    setMapLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/api/lots/map-data", { withCredentials: true });
      const lots = res.data?.lots || [];
      // For add: only Available lots. For edit: Available + the currently assigned lot
      setMapLots(mode === "edit" ? lots.filter((l) => l.status === "Available" || l.status === "Pending") : lots.filter((l) => l.status === "Available"));
    } catch { setMapLots([]); }
    finally { setMapLoading(false); }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const lower = searchTerm.toLowerCase();
    return clients.filter((c) =>
      `${c.full_name} ${c.email} ${c.contact_number} ${c.address}`.toLowerCase().includes(lower)
    );
  }, [clients, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ROWS_PER_PAGE));
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredClients.slice(start, start + ROWS_PER_PAGE);
  }, [filteredClients, currentPage]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  // ─── Add Client ───────────────────────────────────────────────────────────────
  const handleInputChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleOpenModal = () => {
    setFormData(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setSelectedLot(null);
    setModalStep(1);
    setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setSelectedLot(null); setModalStep(1); };

  // Step 1 → Step 2: validate then go to lot selection
  const handleNextStep = (e) => {
    e.preventDefault();
    const { full_name, contact_number, email, address } = formData;
    if (!full_name.trim() || !contact_number.trim() || !email.trim() || !address.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }
    setFormError("");
    setModalStep(2);
    fetchMapLots();
  };

  const handleSubmit = async () => {
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);
    try {
      // 1. Create the client
      await axios.post("http://localhost:5000/api/clients", formData, { withCredentials: true });

      // 2. If a lot was selected, assign it to Pending
      if (selectedLot) {
        await fetch(`http://localhost:5000/api/lots/${selectedLot.lot_id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "Pending", email: formData.email }),
        });
      }

      setFormSuccess(selectedLot
        ? `Client added and Lot #${selectedLot.lot_number} set to Pending!`
        : "Client added successfully!");
      await fetchClients();
      setTimeout(() => handleCloseModal(), 1500);
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to add client. Please try again.");
    } finally { setSubmitting(false); }
  };

  // ─── Edit Client ──────────────────────────────────────────────────────────────
  const handleOpenEdit = (client) => {
    setEditingClient(client);
    setEditFormData({ full_name: client.full_name || "", contact_number: client.contact_number || "", email: client.email || "", address: client.address || "" });
    setEditSelectedLot(null);
    setEditModalStep(1);
    setEditError(""); setEditSuccess(""); setShowEditModal(true);
  };
  const handleCloseEdit = () => { setShowEditModal(false); setEditModalStep(1); setEditSelectedLot(null); };
  const handleEditInputChange = (e) => setEditFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleEditNextStep = (e) => {
    e.preventDefault();
    const { full_name, contact_number, email, address } = editFormData;
    if (!full_name.trim() || !contact_number.trim() || !email.trim() || !address.trim()) { setEditError("Please fill in all required fields."); return; }
    setEditError("");
    setEditModalStep(2);
    fetchMapLots("edit");
  };

  const handleEditSubmit = async () => {
    setEditError(""); setEditSuccess("");
    setEditSubmitting(true);
    try {
      // 1. Update client info
      await axios.put(`http://localhost:5000/api/clients/${editingClient.customer_id}`, editFormData, { withCredentials: true });

      // 2. If lot changed — assign new lot or remove
      if (editSelectedLot === false) {
        // Remove lot assignment (set lot back to Available)
        if (editingClient.lot_id) {
          await fetch(`http://localhost:5000/api/lots/${editingClient.lot_id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "Available", email: "" }),
          });
        }
      } else if (editSelectedLot && editSelectedLot.lot_id !== editingClient.lot_id) {
        // First, FREE UP the old lot (if the client had one)
        if (editingClient.lot_id) {
          await fetch(`http://localhost:5000/api/lots/${editingClient.lot_id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "Available", email: "" }),
          });
        }
        
        // Then, ASSIGN the new lot
        await fetch(`http://localhost:5000/api/lots/${editSelectedLot.lot_id}/status`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "Pending", email: editFormData.email }),
        });
      }

      setEditSuccess("Client updated successfully!");
      await fetchClients();
      setTimeout(() => handleCloseEdit(), 1200);
    } catch (err) { setEditError(err?.response?.data?.message || "Failed to update client."); }
    finally { setEditSubmitting(false); }
  };

  // ─── Delete Client ────────────────────────────────────────────────────────────
  const handleOpenDelete = (client) => { setDeleteTarget(client); setShowDeleteConfirm(true); };
  const handleCloseDelete = () => { setShowDeleteConfirm(false); setDeleteTarget(null); };
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.customer_id);
    try {
      await axios.delete(`http://localhost:5000/api/clients/${deleteTarget.customer_id}`, { withCredentials: true });
      await fetchClients();
      handleCloseDelete();
    } catch { }
    finally { setDeletingId(null); }
  };

  // ─── Shared form fields ───────────────────────────────────────────────────────
  const formFields = (data, onChange, idPrefix) => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
        <input id={`${idPrefix}-full-name`} name="full_name" type="text" value={data.full_name} onChange={onChange} placeholder="e.g. Juan Dela Cruz" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number <span className="text-red-500">*</span></label>
          <input id={`${idPrefix}-contact`} name="contact_number" type="text" value={data.contact_number} onChange={onChange} placeholder="09XXXXXXXXX" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
          <input id={`${idPrefix}-email`} name="email" type="email" value={data.email} onChange={onChange} placeholder="email@example.com" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-red-500">*</span></label>
        <input id={`${idPrefix}-address`} name="address" type="text" value={data.address} onChange={onChange} placeholder="Full address" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" required />
      </div>
    </>
  );

  // ─── Map center ───────────────────────────────────────────────────────────────
  const mapCenter = useMemo(() => {
    if (mapLots.length === 0) return [10.7202, 122.5621];
    const allCoords = mapLots.flatMap((l) => l.coordinates || []);
    if (allCoords.length === 0) return [10.7202, 122.5621];
    const avgLat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
    const avgLng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
    return [avgLat, avgLng];
  }, [mapLots]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="space-y-4 p-6"><h1 className="text-2xl font-bold">My Clients</h1><p className="text-sm text-gray-500">Loading clients...</p></div>;
  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and view your client list.</p>
        </div>
        <button id="add-client-btn" onClick={handleOpenModal} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
          + Add Client
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total Clients</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{clients.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Search Results</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{filteredClients.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <input id="client-search" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, email, contact..." className="w-full md:max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500" />
        </div>

        {paginatedClients.length === 0 ? (
          <p className="text-sm text-gray-500">{clients.length === 0 ? "No clients yet. Click \"+ Add Client\" to get started." : "No clients match your search."}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["#", "Full Name", "Contact Number", "Email", "Address", "Actions"].map((col) => (
                      <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedClients.map((client, idx) => (
                    <tr key={client.customer_id ?? idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{client.contact_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{client.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{client.address}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenEdit(client)} className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">Edit</button>
                          <button onClick={() => handleOpenDelete(client)} disabled={deletingId === client.customer_id} className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                            {deletingId === client.customer_id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredClients.length)} of {filteredClients.length}</span>
              <div className="flex items-center gap-2">
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Add Client Modal (2-step) ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`bg-white rounded-xl shadow-xl mx-4 overflow-hidden transition-all duration-300 ${modalStep === 2 ? "w-full max-w-4xl" : "w-full max-w-lg"}`}>

            {/* Step indicator */}
            <div className="flex border-b border-gray-200">
              <div className={`flex-1 py-3 text-center text-sm font-medium ${modalStep === 1 ? "bg-gray-900 text-white" : "text-gray-500"}`}>
                Step 1: Client Info
              </div>
              <div className={`flex-1 py-3 text-center text-sm font-medium ${modalStep === 2 ? "bg-gray-900 text-white" : "text-gray-400"}`}>
                Step 2: Select Lot (Optional)
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {modalStep === 1 ? "Add New Client" : "Select a Lot"}
                </h2>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              {formError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
              {formSuccess && <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{formSuccess}</div>}

              {/* ── Step 1: Client Info ── */}
              {modalStep === 1 && (
                <form onSubmit={handleNextStep} className="space-y-4">
                  {formFields(formData, handleInputChange, "add")}
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={handleCloseModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
                      Next: Select Lot →
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step 2: Lot Map Selection ── */}
              {modalStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Click on an <span className="font-semibold text-green-600">Available</span> lot to assign it to this client. You can also skip this step.
                  </p>

                  {selectedLot && (
                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      <span>✅ Selected: <strong>Lot #{selectedLot.lot_number}</strong></span>
                      <button onClick={() => setSelectedLot(null)} className="ml-auto text-green-500 hover:text-green-700 text-lg leading-none">&times;</button>
                    </div>
                  )}

                  {mapLoading ? (
                    <div className="h-80 flex items-center justify-center text-sm text-gray-500">Loading map...</div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: "420px" }}>
                      <MapContainer center={mapCenter} zoom={19} maxZoom={22} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          maxZoom={22}
                          maxNativeZoom={18}
                        />
                        <InvalidateSize />
                        {mapLots.map((lot, index) => {
                          const isSelected = selectedLot?.lot_id === lot.lot_id;
                          const statusColor = isSelected ? "#2563eb" : getStatusColor(lot.status);
                          const centerLat = lot.coordinates.reduce((s, c) => s + c[0], 0) / lot.coordinates.length;
                          const centerLng = lot.coordinates.reduce((s, c) => s + c[1], 0) / lot.coordinates.length;
                          const pinLat = centerLat + 0.00012;

                          return (
                            <React.Fragment key={index}>
                              <Polygon
                                positions={lot.coordinates}
                                pathOptions={{
                                  color: statusColor,
                                  fillColor: statusColor,
                                  fillOpacity: isSelected ? 0.75 : 0.6,
                                  weight: isSelected ? 4 : 3,
                                }}
                                eventHandlers={{ click: () => setSelectedLot(isSelected ? null : lot) }}
                              />
                              <Polyline
                                positions={[[centerLat, centerLng], [pinLat, centerLng]]}
                                pathOptions={{ color: "#ffffff", weight: 1, dashArray: "2, 4", opacity: 0.7 }}
                              />
                              <Marker
                                position={[pinLat, centerLng]}
                                icon={createPinIcon(lot.status, isSelected)}
                                eventHandlers={{ click: () => setSelectedLot(isSelected ? null : lot) }}
                              >
                                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                                  <div className="text-center text-xs leading-tight">
                                    <div className="mb-1">{lot.lot_number}</div>
                                    <div className="mb-1 text-[12px] font-bold text-gray-600">{lot.area_sqm} sqm</div>
                                    <div className="mb-1 text-[12px] font-bold" style={{ color: getStatusColor(lot.status) }}>{lot.status}</div>
                                  </div>
                                </Tooltip>
                              </Marker>
                            </React.Fragment>
                          );
                        })}
                      </MapContainer>
                    </div>
                  )}

                  {mapLots.length === 0 && !mapLoading && (
                    <p className="text-sm text-yellow-600">No available lots to assign.</p>
                  )}

                  <div className="flex justify-between gap-3 pt-2">
                    <button type="button" onClick={() => { setModalStep(1); setSelectedLot(null); }} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      ← Back
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setSelectedLot(null); handleSubmit(); }} disabled={submitting} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {submitting ? "Saving..." : "Skip & Save"}
                      </button>
                      <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
                        {submitting ? "Saving..." : selectedLot ? `Save & Assign Lot #${selectedLot.lot_number}` : "Save Client"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Client Modal (2-step) ──────────────────────────────────────────── */}
      {showEditModal && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`bg-white rounded-xl shadow-xl mx-4 overflow-hidden transition-all duration-300 ${editModalStep === 2 ? "w-full max-w-4xl" : "w-full max-w-lg"}`}>

            {/* Step indicator */}
            <div className="flex border-b border-gray-200">
              <div className={`flex-1 py-3 text-center text-sm font-medium ${editModalStep === 1 ? "bg-blue-600 text-white" : "text-gray-500"}`}>
                Step 1: Client Info
              </div>
              <div className={`flex-1 py-3 text-center text-sm font-medium ${editModalStep === 2 ? "bg-blue-600 text-white" : "text-gray-400"}`}>
                Step 2: Edit Lot (Optional)
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editModalStep === 1 ? "Edit Client" : "Change Lot Assignment"}
                </h2>
                <button onClick={handleCloseEdit} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              {editError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}
              {editSuccess && <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{editSuccess}</div>}

              {/* Step 1: Client Info */}
              {editModalStep === 1 && (
                <form onSubmit={handleEditNextStep} className="space-y-4">
                  {formFields(editFormData, handleEditInputChange, "edit")}
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={handleCloseEdit} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                      Next: Edit Lot →
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Lot Map */}
              {editModalStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Current lot: <span className="font-medium text-orange-600">{editingClient.lot_id ? `Lot linked (ID: ${editingClient.lot_id})` : "None"}</span>.
                    Click an <span className="font-semibold text-green-600">Available</span> lot to reassign, or remove the current assignment.
                  </p>

                  {editSelectedLot === false && (
                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span>🗑️ Lot assignment will be removed</span>
                      <button onClick={() => setEditSelectedLot(null)} className="ml-auto text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                    </div>
                  )}
                  {editSelectedLot && editSelectedLot !== false && (
                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      <span>🔄 New lot: <strong>Lot #{editSelectedLot.lot_number}</strong></span>
                      <button onClick={() => setEditSelectedLot(null)} className="ml-auto text-blue-500 hover:text-blue-700 text-lg leading-none">&times;</button>
                    </div>
                  )}

                  {mapLoading ? (
                    <div className="h-80 flex items-center justify-center text-sm text-gray-500">Loading map...</div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: "420px" }}>
                      <MapContainer center={mapCenter} zoom={19} maxZoom={22} style={{ height: "100%", width: "100%" }}>
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={22} maxNativeZoom={18} />
                        <InvalidateSize />
                        {mapLots.map((lot, index) => {
                          const isNewSelected = editSelectedLot && editSelectedLot !== false && editSelectedLot.lot_id === lot.lot_id;
                          const isCurrent = editingClient.lot_id === lot.lot_id;
                          const statusColor = isNewSelected ? "#2563eb" : isCurrent ? "#f97316" : getStatusColor(lot.status);
                          const centerLat = lot.coordinates.reduce((s, c) => s + c[0], 0) / lot.coordinates.length;
                          const centerLng = lot.coordinates.reduce((s, c) => s + c[1], 0) / lot.coordinates.length;
                          const pinLat = centerLat + 0.00012;
                          return (
                            <React.Fragment key={index}>
                              <Polygon
                                positions={lot.coordinates}
                                pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: isNewSelected || isCurrent ? 0.75 : 0.6, weight: isNewSelected || isCurrent ? 4 : 3 }}
                                eventHandlers={{ click: () => lot.status === "Available" && setEditSelectedLot(isNewSelected ? null : lot) }}
                              />
                              <Polyline positions={[[centerLat, centerLng], [pinLat, centerLng]]} pathOptions={{ color: "#ffffff", weight: 1, dashArray: "2, 4", opacity: 0.7 }} />
                              <Marker position={[pinLat, centerLng]} icon={createPinIcon(lot.status, isNewSelected)}
                                eventHandlers={{ click: () => lot.status === "Available" && setEditSelectedLot(isNewSelected ? null : lot) }}>
                                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                                  <div className="text-center text-xs leading-tight">
                                    <div className="mb-1">{lot.lot_number}</div>
                                    <div className="mb-1 text-[12px] font-bold text-gray-600">{lot.area_sqm} sqm</div>
                                    <div className="mb-1 text-[12px] font-bold" style={{ color: getStatusColor(lot.status) }}>{isCurrent ? "Current" : lot.status}</div>
                                  </div>
                                </Tooltip>
                              </Marker>
                            </React.Fragment>
                          );
                        })}
                      </MapContainer>
                    </div>
                  )}

                  <div className="flex justify-between gap-3 pt-2">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditModalStep(1); setEditSelectedLot(null); }} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">← Back</button>
                      {editingClient.lot_id && editSelectedLot !== false && (
                        <button type="button" onClick={() => setEditSelectedLot(false)} className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100">
                          Remove Lot
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditSelectedLot(null); handleEditSubmit(); }} disabled={editSubmitting} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {editSubmitting ? "Saving..." : "Skip & Save"}
                      </button>
                      <button type="button" onClick={handleEditSubmit} disabled={editSubmitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {editSubmitting ? "Saving..." : editSelectedLot && editSelectedLot !== false ? `Save & Assign Lot #${editSelectedLot.lot_number}` : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ──────────────────────────────────────────────── */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Client</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.full_name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={handleCloseDelete} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={!!deletingId} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClients;
