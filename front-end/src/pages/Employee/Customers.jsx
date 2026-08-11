import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ROWS_PER_PAGE = 10;

const inputCls = "w-full md:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors";
const paginBtnCls = "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";

const Customers = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await axios.get(`${API_BASE_URL}/api/auth/check-session`, { withCredentials: true });
        const role = sessionRes.data.role;
        if (role !== "employee" && role !== "admin") { window.location.href = "/forbidden"; return; }
        setIsAuthorized(true);
        await fetchCustomers();
      } catch (err) {
        if (err?.response?.status === 401) { window.location.href = "/access-denied"; return; }
        setError("Unable to load customer data. Please refresh and try again.");
      } finally { setLoading(false); }
    };
    init();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`, { withCredentials: true });
      const fetched = Array.isArray(res.data) ? res.data : [];
      setCustomers(fetched);
      try { sessionStorage.setItem("customersCache", JSON.stringify(fetched)); } catch (e) {}
    } catch { setCustomers([]); }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lower = searchTerm.toLowerCase();
    return customers.filter((c) =>
      `${c.full_name} ${c.email} ${c.contact_number} ${c.address}`.toLowerCase().includes(lower)
    );
  }, [customers, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ROWS_PER_PAGE));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredCustomers.slice(start, start + ROWS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  if (loading) return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Customers</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400">Loading customers...</p>
    </div>
  );
  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">View and search your customer list.</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <p className="text-sm text-gray-500 dark:text-slate-400">Total Customers</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">{customers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <p className="text-sm text-gray-500 dark:text-slate-400">Search Results</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">{filteredCustomers.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
        <div className="mb-4">
          <input id="customer-search" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, email, contact..." className={inputCls} />
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
                    {["#", "Full Name", "Contact Number", "Email", "Address"].map((col) => (
                      <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {paginatedCustomers.map((customer, idx) => (
                    <tr key={customer.customer_id ?? idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{customer.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{customer.contact_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{customer.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{customer.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
              <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredCustomers.length)} of {filteredCustomers.length}</span>
              <div className="flex items-center gap-2">
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className={paginBtnCls}>Previous</button>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={paginBtnCls}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Customers;
