import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ROWS_PER_PAGE = 10;

const paginBtnCls =
  "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";

const Customers = () => {
  const [customers, setCustomers] = useState(() => {
    try {
      const cached = sessionStorage.getItem("customersCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("customersCache"));
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE_URL}/api/customers`, { withCredentials: true, headers });
      const fetched = Array.isArray(res.data) ? res.data : [];
      setCustomers(fetched);
      try {
        sessionStorage.setItem("customersCache", JSON.stringify(fetched));
      } catch (e) {}
    } catch {
      setError("Unable to load customer data. Please refresh and try again.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Show all customer records individually (including cancelled history per lot)
  const filteredCustomersByEmail = useMemo(() => {
    return customers.filter((c) => {
      const rawStatus = String(c.lot_status || "").toLowerCase();
      const normalizedStatus = rawStatus === "available" ? "cancelled" : rawStatus;

      const matchesStatus =
        statusFilter === "all" ? true : normalizedStatus === statusFilter.toLowerCase();

      const lower = searchTerm.trim().toLowerCase();
      const matchesSearch = lower
        ? `${c.full_name} ${c.email} ${c.contact_number} ${c.lot_number || ""} ${c.property_name || ""}`.toLowerCase().includes(lower)
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [customers, searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomersByEmail.length / ROWS_PER_PAGE));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredCustomersByEmail.slice(start, start + ROWS_PER_PAGE);
  }, [filteredCustomersByEmail, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (loading)
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          My Clients
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading clients...</p>
      </div>
    );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            My Clients
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            View and search your client list and assigned lots.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <input
            id="customer-search"
            name="customer_search"
            aria-label="Search by name, email, contact"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, contact..."
            className="w-full sm:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
          />

          <div className="flex items-center gap-3">
            <select
              id="customer-status-filter"
              name="customer_status_filter"
              aria-label="Filter customer status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {paginatedCustomers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {customers.length === 0
              ? "No customers yet. Customers are added when lots are marked as pending in the map view."
              : "No customers match your search."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    {["Full Name", "Contact Number", "Email", "Lot Details", "Status"].map((col) => (
                      <th
                        key={col}
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {paginatedCustomers.map((customer, idx) => (
                    <tr
                      key={customer.customer_id ?? idx}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {customer.full_name}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        {customer.contact_number}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300 break-all">
                        {customer.email}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {customer.lot_number ? (
                          <span>
                            {customer.lot_number}
                            {(customer.property_name || customer.property_id) && (
                              <span className="text-gray-400 dark:text-slate-500 font-normal"> &bull; {customer.property_name || `Property ${customer.property_id}`}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(customer.lot_status === "Available" || customer.lot_status === "Cancelled") ? (
                          <span className="text-xs font-semibold text-purple-500 dark:text-purple-400">
                            Cancelled
                          </span>
                        ) : customer.lot_status === "Pending" ? (
                          <span className="text-xs font-semibold text-amber-500 dark:text-amber-400">
                            Pending
                          </span>
                        ) : customer.lot_status === "Sold" ? (
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                            Sold
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                            {customer.lot_status || "Unknown"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
              <span>
                Total: {filteredCustomersByEmail.length}{" "}
                {filteredCustomersByEmail.length === 1 ? "client" : "clients"}
              </span>
              <div className="flex items-center gap-2">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={paginBtnCls}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={paginBtnCls}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Customers;
