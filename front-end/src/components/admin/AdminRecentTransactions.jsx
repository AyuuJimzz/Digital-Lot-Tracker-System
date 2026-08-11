import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";

const STATUS_STYLES = {
  Sold: "bg-green-100 text-green-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_STYLES = {
  Cash: "bg-blue-100 text-blue-700",
  Installment: "bg-purple-100 text-purple-700",
  "No Downpayment": "bg-orange-100 text-orange-700",
};

const RecentTransactions = () => {
  const [filter, setFilter] = useState("All");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch transactions from API
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        console.log("Fetching transactions from API...");
        const response = await axios.get(`${API_BASE_URL}/api/transactions`);
        console.log("API Response status:", response.status);
        console.log("API Response data:", response.data);
        console.log("Number of transactions received:", response.data.length);
        setTransactions(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        console.error("Error details:", err.response?.status, err.response?.data);
        setError("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filtered =
    filter === "All" ? transactions : transactions.filter((t) => t.status === filter);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Transactions
          </h3>
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">⚠️ {error}</p>}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {["All", "Sold", "Pending"].map((f) => (
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              {["Transaction ID", "Client", "Lot #", "Property", "Date", "Payment", "Status"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-sm text-gray-400 text-center">
                  Loading transactions...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-sm text-gray-400 text-center">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filtered.map((txn) => (
                <tr
                  key={txn.transaction_id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {txn.transaction_id}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">
                    {txn.customer_name}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-400">
                    {txn.lot_number}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-400">
                    {txn.property_name}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-500">
                    {txn.transaction_date}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${PAYMENT_STYLES[txn.payment_type] || "bg-gray-100 text-gray-700"}`}
                    >
                      {txn.payment_type}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_STYLES[txn.status] || "bg-gray-100 text-gray-800"}`}
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

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between items-center">
        <span>
          Showing {filtered.length} of {transactions.length} transactions
        </span>
      </div>
    </div>
  );
};

export default RecentTransactions;
