import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ROWS_PER_PAGE = 10;

const EMPTY_FORM = {
  full_name: "",
  contact_number: "",
  email: "",
  address: "",
  valid_id_type: "",
  valid_id_number: "",
};

const MyClients = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await axios.get(
          "http://localhost:5000/api/auth/check-session",
          { withCredentials: true }
        );

        const role = sessionRes.data.role;
        if (role !== "employee" && role !== "admin") {
          window.location.href = "/forbidden";
          return;
        }

        setIsAuthorized(true);
        await fetchClients();
      } catch (err) {
        if (err?.response?.status === 401) {
          window.location.href = "/access-denied";
          return;
        }
        setError("Unable to load client data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/clients", {
        withCredentials: true,
      });
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Clients endpoint may not exist yet — silently fail
      setClients([]);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const lower = searchTerm.toLowerCase();
    return clients.filter((c) =>
      `${c.full_name} ${c.email} ${c.contact_number} ${c.address}`
        .toLowerCase()
        .includes(lower)
    );
  }, [clients, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ROWS_PER_PAGE));
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredClients.slice(start, start + ROWS_PER_PAGE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Form handlers
  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOpenModal = () => {
    setFormData(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const { full_name, contact_number, email, address } = formData;

    if (!full_name.trim() || !contact_number.trim() || !email.trim() || !address.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post("http://localhost:5000/api/clients", formData, {
        withCredentials: true,
      });
      setFormSuccess("Client added successfully!");
      await fetchClients();
      setTimeout(() => {
        setShowModal(false);
      }, 1200);
    } catch (err) {
      setFormError(
        err?.response?.data?.message || "Failed to add client. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Clients</h1>
        <p className="text-sm text-gray-500">Loading clients...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and view your client list.</p>
        </div>
        <button
          id="add-client-btn"
          onClick={handleOpenModal}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add Client
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
          <input
            id="client-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, contact..."
            className="w-full md:max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
        </div>

        {paginatedClients.length === 0 ? (
          <p className="text-sm text-gray-500">
            {clients.length === 0
              ? "No clients yet. Click \"+ Add Client\" to get started."
              : "No clients match your search."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["#", "Full Name", "Contact Number", "Email", "Address", "Valid ID"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedClients.map((client, idx) => (
                    <tr key={client.client_id ?? idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {client.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {client.contact_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {client.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {client.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {client.valid_id_type
                          ? `${client.valid_id_type} – ${client.valid_id_number}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–
                {Math.min(currentPage * ROWS_PER_PAGE, filteredClients.length)} of{" "}
                {filteredClients.length}
              </span>
              <div className="flex items-center gap-2">
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add New Client</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-full-name"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="client-contact"
                    name="contact_number"
                    type="text"
                    value={formData.contact_number}
                    onChange={handleInputChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="client-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@example.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid ID Type
                  </label>
                  <select
                    id="client-id-type"
                    name="valid_id_type"
                    value={formData.valid_id_type}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="">Select ID type</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="Passport">Passport</option>
                    <option value="SSS ID">SSS ID</option>
                    <option value="PhilHealth ID">PhilHealth ID</option>
                    <option value="Postal ID">Postal ID</option>
                    <option value="Voter's ID">Voter's ID</option>
                    <option value="National ID">National ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid ID Number
                  </label>
                  <input
                    id="client-id-number"
                    name="valid_id_number"
                    type="text"
                    value={formData.valid_id_number}
                    onChange={handleInputChange}
                    placeholder="ID number"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  id="submit-client-btn"
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Saving..." : "Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClients;
