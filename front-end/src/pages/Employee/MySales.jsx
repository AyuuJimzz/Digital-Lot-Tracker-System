import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ROWS_PER_PAGE = 10;

const getStatusColor = (status) => {
  switch (status) {
    case "Available": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Pending":   return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "Sold":      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:          return "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300";
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
const selectCls =
  "w-full md:w-40 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors";
const paginBtnCls =
  "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";

const MySales = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [salesRecords, setSalesRecords] = useState(() => {
    try {
      const cached = sessionStorage.getItem("employeeSalesRecordsCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("employeeSalesRecordsCache"));
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const sessionResponse = await axios.get(`${API_BASE_URL}/api/auth/check-session`, { withCredentials: true });
        if (sessionResponse.data.role !== "employee" && sessionResponse.data.role !== "admin") {
          window.location.href = "/forbidden"; return;
        }
        setIsAuthorized(true);

        const [lotsResponse, customersResponse, propertiesResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/all`, { withCredentials: true }),
          axios.get(`${API_BASE_URL}/api/customers`, { withCredentials: true }),
          axios.get(`${API_BASE_URL}/api/properties`, { withCredentials: true }),
        ]);

        const fetchedLots = Array.isArray(lotsResponse.data) ? lotsResponse.data : [];
        const fetchedCustomers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
        const fetchedProperties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];

        // Build lookup map for properties
        const propMap = new Map();
        fetchedProperties.forEach((p) => {
          propMap.set(Number(p.property_id), p.property_name || `Property ${p.property_id}`);
        });

        // Build lookup map for customers by lot_id
        const custMap = new Map();
        fetchedCustomers.forEach((c) => {
          if (c.lot_id) {
            custMap.set(Number(c.lot_id), c);
          }
        });

        // Filter only sold & pending lots
        const sales = fetchedLots
          .filter((l) => ["sold", "pending"].includes(String(l.status || "").toLowerCase()))
          .map((lot) => {
            const cust = custMap.get(Number(lot.lot_id));
            const rawDate = cust?.created_at || lot.pending_since || lot.updated_at || null;
            return {
              lot_id: lot.lot_id,
              sale_ref: `REF-${String(lot.lot_id).padStart(4, "0")}`,
              sale_date: formatSaleDate(rawDate),
              lot_number: lot.lot_number,
              property_id: lot.property_id,
              property_name: propMap.get(Number(lot.property_id)) || `Property ${lot.property_id}`,
              area_sqm: lot.area_sqm,
              status: lot.status,
              buyer_name: cust?.full_name || "—",
              buyer_contact: cust?.contact_number || "",
              buyer_email: cust?.email || "",
            };
          });

        setSalesRecords(sales);
        try {
          sessionStorage.setItem("employeeSalesRecordsCache", JSON.stringify(sales));
        } catch (e) {}
      } catch (requestError) {
        if (requestError?.response?.status === 401) { window.location.href = "/access-denied"; return; }
        setError("Unable to load sales data. Please refresh and try again.");
      } finally { setLoading(false); }
    };
    fetchSalesData();
  }, []);

  const filteredSales = useMemo(() => {
    return salesRecords.filter((sale) => {
      const searchText =
        `${sale.sale_ref} ${sale.lot_number} ${sale.buyer_name} ${sale.buyer_contact} ${sale.buyer_email} ${sale.property_name} ${sale.status} ${sale.area_sqm} ${sale.sale_date || ""}`.toLowerCase();
      const matchesSearch = searchTerm.trim()
        ? searchText.includes(searchTerm.trim().toLowerCase())
        : true;
      const matchesStatus =
        statusFilter === "all" ? true : String(sale.status || "").toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salesRecords, searchTerm, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ROWS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredSales.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSales, currentPage]);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  if (loading) return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Sales</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400">Loading sales...</p>
    </div>
  );
  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Sales</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Track sold and pending lot transactions.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {!error && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ref, lot, client name, property..."
                className={inputCls}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All Status</option>
                <option value="sold">Sold</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {filteredSales.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-slate-400">No sales records match your current filter.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        {[
                          "Ref / Date",
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
                              <span className="block text-xs text-gray-500 dark:text-slate-400 font-normal mt-0.5">
                                {sale.sale_date}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm">
                            <span className="font-semibold text-blue-600 dark:text-blue-400 block">
                              {sale.lot_number}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-slate-400 font-normal">
                              {sale.property_name}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 text-sm text-gray-900 dark:text-white">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {sale.buyer_name}
                            </span>
                            {(sale.buyer_contact || sale.buyer_email) && (
                              <span className="block text-xs text-gray-500 dark:text-slate-400 font-normal mt-0.5">
                                {[sale.buyer_contact, sale.buyer_email].filter(Boolean).join(" | ")}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">
                            {sale.area_sqm ? `${sale.area_sqm} sqm` : "-"}
                          </td>
                          <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sale.status)}`}>{sale.status ?? "Unknown"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredSales.length)} of {filteredSales.length}</span>
                  <div className="flex items-center gap-2">
                    <span>Page {currentPage} of {totalPages}</span>
                    <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className={paginBtnCls}>Previous</button>
                    <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={paginBtnCls}>Next</button>
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
