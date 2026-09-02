import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";

const STATUS_STYLES = {
  Sold: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Cancelled: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const PAYMENT_STYLES = {
  Cash: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Installment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "No Downpayment": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const RecentTransactions = () => {
  const [filter, setFilter] = useState("All");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [empNameMap, setEmpNameMap] = useState({});

  // Fetch transactions + employees from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [txnRes, empRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/transactions`, { withCredentials: true, headers }),
          axios.get(`${API_BASE_URL}/api/employees`, { withCredentials: true, headers }),
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

  // Filter transactions
  const filtered =
    filter === "All" ? transactions : transactions.filter((t) => t.status === filter);

  // Reset to page 1 on filter or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, pageSize]);

  // Pagination calculations
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedTransactions = filtered.slice(startIndex, endIndex);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Transactions
          </h3>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-medium">
              {totalCount} total
            </span>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">⚠️ {error}</p>}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <span>Show:</span>
            <select
              id="admin-transactions-page-size"
              name="admin_transactions_page_size"
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
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">
                Payment
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">
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
                  <td className="px-4 py-3.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full px-2 py-0.5">
                      {txn.employee_id && empNameMap[txn.employee_id] ? empNameMap[txn.employee_id] : "Admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                        PAYMENT_STYLES[txn.payment_type] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {txn.payment_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                        STATUS_STYLES[txn.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
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

export default RecentTransactions;
