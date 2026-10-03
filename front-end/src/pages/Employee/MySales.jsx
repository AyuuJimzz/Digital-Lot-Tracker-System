import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

const ROWS_PER_PAGE = 10;
const EMPTY_SALES = [];

const getStatusColor = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "available":
      return "text-green-600 dark:text-green-400 font-semibold";
    case "pending":
      return "text-amber-500 dark:text-amber-400 font-semibold";
    case "sold":
      return "text-red-600 dark:text-red-400 font-semibold";
    case "cancelled":
      return "text-slate-500 dark:text-slate-400 font-semibold";
    default:
      return "text-gray-600 dark:text-slate-400 font-semibold";
  }
};

const formatSaleDate = (dateString) => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return null;
  }
};

const inputCls =
  "w-full md:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors";
const paginBtnCls =
  "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";

const MySales = () => {
  const salesQuery = useQuery({
    queryKey: ["my-sales"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const [lotsResponse, customersResponse, propertiesResponse, txnsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/lots/all`, authConfig),
        axios.get(`${API_BASE_URL}/api/customers`, authConfig),
        axios.get(`${API_BASE_URL}/api/properties`, authConfig),
        axios.get(`${API_BASE_URL}/api/transactions?scope=personal`, authConfig),
      ]);

      const fetchedLots = Array.isArray(lotsResponse.data) ? lotsResponse.data : [];
      const fetchedCustomers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
      const fetchedProperties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];
      const fetchedTransactions = Array.isArray(txnsResponse.data) ? txnsResponse.data : [];

      const propMap = new Map();
      fetchedProperties.forEach((p) => {
        propMap.set(Number(p.property_id), p.property_name || `Property ${p.property_id}`);
      });
      const lotMap = new Map();
      fetchedLots.forEach((l) => {
        lotMap.set(Number(l.lot_id), l);
      });
      const custMap = new Map();
      fetchedCustomers.forEach((c) => {
        if (c.lot_id) custMap.set(Number(c.lot_id), c);
      });

      const sales = [];
      const seenLotIds = new Set();
      fetchedTransactions.forEach((t) => {
        // Strictly completed / closed sales only
        if (String(t.status || "").toLowerCase() !== "sold") return;
        const lot = lotMap.get(Number(t.lot_id));
        const cust = custMap.get(Number(t.lot_id));
        if (t.lot_id) seenLotIds.add(Number(t.lot_id));
        sales.push({
          lot_id: t.lot_id,
          sale_ref: t.transaction_id || `TXN-${String(t.lot_id).padStart(4, "0")}`,
          sale_date: formatSaleDate(t.transaction_date),
          lot_number: t.lot_number || lot?.lot_number || `Lot ${t.lot_id}`,
          property_id: lot?.property_id,
          property_name: t.property_name || (lot?.property_id ? propMap.get(Number(lot.property_id)) : "—"),
          area_sqm: lot?.area_sqm,
          status: "Sold",
          buyer_name: t.customer_name || cust?.full_name || "—",
          buyer_contact: cust?.contact_number || "",
          buyer_email: cust?.email || "",
        });
      });

      return sales;
    },
    staleTime: 60 * 1000,
  });
  const salesRecords = salesQuery.data || EMPTY_SALES;
  const loading = salesQuery.isPending;
  const error = salesQuery.error ? "Unable to load sales data. Please refresh and try again." : "";
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredSales = useMemo(() => {
    return salesRecords.filter((sale) => {
      const searchText =
        `${sale.sale_ref} ${sale.lot_number} ${sale.buyer_name} ${sale.buyer_contact} ${sale.buyer_email} ${sale.property_name} ${sale.status} ${sale.area_sqm} ${sale.sale_date || ""}`.toLowerCase();
      return searchTerm.trim()
        ? searchText.includes(searchTerm.trim().toLowerCase())
        : true;
    });
  }, [salesRecords, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ROWS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredSales.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSales, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (loading)
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Sales</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading sales...</p>
      </div>
    );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Sales</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
          Track your completed lot sales and closed deals.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
          <button type="button" onClick={() => salesQuery.refetch()} className="ml-2 underline">Retry</button>
        </div>
      )}

      {(!error || salesQuery.data) && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              id="employee-sales-search"
              name="employee_sales_search"
              aria-label="Search transaction id, lot, client name, or property"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search txn id, lot, client name, property..."
              className={inputCls}
            />
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              {filteredSales.length} {filteredSales.length === 1 ? "completed sale" : "completed sales"}
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {searchTerm.trim() ? "No sales match your search." : "No completed sales recorded yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      {[
                        "Txn ID / Date",
                        "Lot Details",
                        "Client Name",
                        "Area (sqm)",
                        "Status",
                      ].map((col) => (
                        <th
                          key={col}
                          className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {paginatedSales.map((sale) => (
                      <tr
                        key={sale.lot_id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm">
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {sale.sale_ref}
                          </span>
                          {sale.sale_date && (
                            <span className="text-gray-400 dark:text-slate-500 font-normal"> &bull; {sale.sale_date}</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {sale.lot_number}
                          </span>
                          {sale.property_name && (
                            <span className="text-gray-400 dark:text-slate-500 font-normal"> &bull; {sale.property_name}</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                          {sale.buyer_name || "—"}
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">
                          {sale.area_sqm ? `${sale.area_sqm} sqm` : "-"}
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                          <span className={`text-xs ${getStatusColor(sale.status)}`}>
                            {sale.status ?? "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
                <span>
                  Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–
                  {Math.min(currentPage * ROWS_PER_PAGE, filteredSales.length)} of{" "}
                  {filteredSales.length}
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
      )}
    </div>
  );
};

export default MySales;
