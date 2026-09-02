import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";

const STATUS_STYLES = {
  Available: "text-green-600 dark:text-green-400 font-semibold",
  Pending: "text-amber-500 dark:text-amber-400 font-semibold",
  Sold: "text-red-600 dark:text-red-400 font-semibold",
  Cancelled: "text-purple-500 dark:text-purple-400 font-semibold",
};

const EmployeeRecentTransactions = () => {
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [empNameMap, setEmpNameMap] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [txnRes, empRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/transactions`, { withCredentials: true, headers }),
          axios.get(`${API_BASE_URL}/api/employees`, { withCredentials: true, headers }).catch(() => ({ data: [] })),
        ]);
        setTransactions(txnRes.data || []);
        const map = {};
        (empRes.data || []).forEach((e) => {
          map[e.employee_id] = `${e.first_name || ""} ${e.last_name || ""}`.trim();
        });
        setEmpNameMap(map);
        setError(null);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter transactions by status, search query, and date
  const filtered = transactions.filter((t) => {
    // 1. Status filter
    if (filter !== "All" && t.status !== filter) return false;

    // 2. Date filter
    if (selectedDate) {
      const txnDateStr = String(t.transaction_date || t.created_at || "").slice(0, 10);
      if (!txnDateStr.includes(selectedDate)) return false;
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const idStr = String(t.transaction_id || "").toLowerCase();
      const clientStr = (t.customer_name || "").toLowerCase();
      const lotStr = (t.lot_number || "").toLowerCase();
      const propStr = (t.property_name || "").toLowerCase();
      const agentStr = (t.employee_id && empNameMap[t.employee_id] ? empNameMap[t.employee_id] : "admin").toLowerCase();
      const payStr = (t.payment_type || "").toLowerCase();

      const matches =
        idStr.includes(q) ||
        `txn-${idStr}`.includes(q) ||
        clientStr.includes(q) ||
        lotStr.includes(q) ||
        propStr.includes(q) ||
        agentStr.includes(q) ||
        payStr.includes(q);

      if (!matches) return false;
    }

    return true;
  });

  // Reset to page 1 on filter, search, date or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, pageSize, searchQuery, selectedDate]);

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedTransactions = filtered.slice(startIndex, endIndex);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
      {/* Header */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-slate-800 space-y-3">
        {/* Top Row: Title, Total Count, Page Size, Status Pills */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Transactions
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-medium">
              {totalCount} {totalCount === 1 ? "record" : "total"}
            </span>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Page size selector */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <span>Show:</span>
              <select
                id="employee-transactions-page-size"
                name="employee_transactions_page_size"
                aria-label="Select transactions per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1.5">
              {["All", "Sold", "Pending", "Cancelled"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-gray-900 dark:bg-slate-700 text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Second Row: Real-time Search Input + Calendar Date Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, lot, agent, ID..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Date Picker & Reset Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-gray-600 dark:text-slate-300">
              <span className="text-gray-400 dark:text-slate-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <span className="hidden sm:inline text-[11px] font-medium text-gray-500 dark:text-slate-400">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-gray-900 dark:text-slate-200 focus:outline-none cursor-pointer font-mono"
                title="Pick date to go back to transactions on that specific day"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className="text-gray-400 hover:text-rose-500 ml-1 p-0.5"
                  title="Clear date"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {(searchQuery || selectedDate || filter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDate("");
                  setFilter("All");
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50/80 dark:bg-slate-800/80">
            <tr>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[18%]">
                Txn ID / Date
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[22%]">
                Client
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[24%]">
                Lot Details
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[14%]">
                Agent
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[14%]">
                Payment
              </th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-sm text-gray-400 text-center">
                  Loading transactions...
                </td>
              </tr>
            ) : paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-sm text-gray-400 text-center">
                  No transactions found.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((txn) => (
                <tr
                  key={txn.transaction_id}
                  className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-5 py-3.5 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap text-sm">
                    {txn.transaction_id}
                    {txn.transaction_date && (
                      <span className="text-gray-400 dark:text-slate-500 font-normal text-xs"> &bull; {txn.transaction_date}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-slate-200 break-words text-sm">
                    {txn.customer_name}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap text-sm">
                    {txn.lot_number}
                    {txn.property_name && (
                      <span className="text-gray-400 dark:text-slate-500 font-normal"> &bull; {txn.property_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                    {txn.employee_id && empNameMap[txn.employee_id] ? empNameMap[txn.employee_id] : "Admin"}
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                    {txn.payment_type || "No Downpayment"}
                  </td>
                  <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs">
                    <span className={STATUS_STYLES[txn.status] || "text-slate-600 dark:text-slate-400 font-semibold"}>
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer & Pagination Bar */}
      <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3">
        <span>
          Showing {totalCount > 0 ? startIndex + 1 : 0}–{endIndex} of {totalCount} transactions
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={validCurrentPage <= 1}
              className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ Previous
            </button>

            <span className="px-2.5 py-1 text-xs font-mono font-semibold text-gray-700 dark:text-slate-300">
              Page {validCurrentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={validCurrentPage >= totalPages}
              className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeRecentTransactions;
