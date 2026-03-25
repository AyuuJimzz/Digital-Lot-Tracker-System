import React, { useState } from "react";

// ─── MOCK DATA (Replace with real API data when transactions table is ready) ───
const MOCK_TRANSACTIONS = [
  {
    id: "TXN-0001",
    client: "Juan Dela Cruz",
    lot_number: "Lot-A01",
    property: "Golden Dragon Phase 1",
    sale_date: "2026-03-20",
    total_price: 850000,
    payment_type: "Cash",
    status: "Completed",
  },
  {
    id: "TXN-0002",
    client: "Maria Santos",
    lot_number: "Lot-B08",
    property: "Golden Dragon Phase 1",
    sale_date: "2026-03-21",
    total_price: 1200000,
    payment_type: "Installment",
    status: "Pending",
  },
  {
    id: "TXN-0003",
    client: "Pedro Reyes",
    lot_number: "Lot-C15",
    property: "Golden Dragon Phase 2",
    sale_date: "2026-03-22",
    total_price: 975000,
    payment_type: "Cash",
    status: "Completed",
  },
  {
    id: "TXN-0004",
    client: "Ana Gomez",
    lot_number: "Lot-A22",
    property: "Golden Dragon Phase 2",
    sale_date: "2026-03-23",
    total_price: 1050000,
    payment_type: "Installment",
    status: "Pending",
  },
  {
    id: "TXN-0005",
    client: "Jose Ramos",
    lot_number: "Lot-D03",
    property: "Golden Dragon Phase 1",
    sale_date: "2026-03-24",
    total_price: 720000,
    payment_type: "Cash",
    status: "Completed",
  },
];

const STATUS_STYLES = {
  Completed: "bg-green-100 text-green-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_STYLES = {
  Cash: "bg-blue-100 text-blue-700",
  Installment: "bg-purple-100 text-purple-700",
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

const RecentTransactions = () => {
  const [filter, setFilter] = useState("All");

  const filtered =
    filter === "All" ? MOCK_TRANSACTIONS : MOCK_TRANSACTIONS.filter((t) => t.status === filter);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          <p className="text-xs text-amber-600 mt-0.5">
            ⚠️ UI Preview — using mock data. Will connect to real API soon.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {["All", "Completed", "Pending"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Transaction ID",
                "Client",
                "Lot #",
                "Property",
                "Date",
                "Amount",
                "Payment",
                "Status",
              ].map((col) => (
                <th
                  key={col}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-sm text-gray-400 text-center">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filtered.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    {txn.id}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.client}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                    {txn.lot_number}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                    {txn.property}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    {txn.sale_date}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(txn.total_price)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        PAYMENT_STYLES[txn.payment_type] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {txn.payment_type}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
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

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between items-center">
        <span>
          Showing {filtered.length} of {MOCK_TRANSACTIONS.length} transactions
        </span>
      </div>
    </div>
  );
};

export default RecentTransactions;
