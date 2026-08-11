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

const inputCls = "w-full md:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors";
const selectCls = "w-full md:w-40 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors";
const paginBtnCls = "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";
const cardCls = "bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300";

const MySales = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [lots, setLots] = useState(() => {
    try {
      const cached = sessionStorage.getItem("employeeLotsCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("employeeLotsCache"));
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
        const lotsResponse = await axios.get(`${API_BASE_URL}/api/lots/all`, { withCredentials: true });
        const fetchedLots = Array.isArray(lotsResponse.data) ? lotsResponse.data : [];
        setLots(fetchedLots);
        try { sessionStorage.setItem("employeeLotsCache", JSON.stringify(fetchedLots)); } catch (e) {}
      } catch (requestError) {
        if (requestError?.response?.status === 401) { window.location.href = "/access-denied"; return; }
        setError("Unable to load sales data. Please refresh and try again.");
      } finally { setLoading(false); }
    };
    fetchSalesData();
  }, []);

  const salesLots = useMemo(() => lots.filter((l) => ["sold", "pending"].includes(String(l.status || "").toLowerCase())), [lots]);
  const soldCount = useMemo(() => salesLots.filter((l) => String(l.status || "").toLowerCase() === "sold").length, [salesLots]);
  const pendingCount = useMemo(() => salesLots.filter((l) => String(l.status || "").toLowerCase() === "pending").length, [salesLots]);

  const filteredSales = useMemo(() => salesLots.filter((lot) => {
    const searchText = `${lot.lot_id} ${lot.lot_number} ${lot.property_id} ${lot.status} ${lot.area_sqm}`.toLowerCase();
    const matchesSearch = searchTerm.trim() ? searchText.includes(searchTerm.trim().toLowerCase()) : true;
    const matchesStatus = statusFilter === "all" ? true : String(lot.status || "").toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  }), [salesLots, searchTerm, statusFilter]);

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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={cardCls}>
              <p className="text-sm text-gray-500 dark:text-slate-400">Total Sales Records</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">{salesLots.length}</p>
            </div>
            <div className={cardCls}>
              <p className="text-sm text-gray-500 dark:text-slate-400">Completed Sales</p>
              <p className="text-2xl font-semibold text-green-700 dark:text-green-400 mt-2">{soldCount}</p>
            </div>
            <div className={cardCls}>
              <p className="text-sm text-gray-500 dark:text-slate-400">Pending Sales</p>
              <p className="text-2xl font-semibold text-yellow-700 dark:text-yellow-400 mt-2">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search lot id, lot number, property" className={inputCls} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
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
                        {["Sale Ref", "Lot Number", "Property", "Area (sqm)", "Status"].map((col) => (
                          <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                      {paginatedSales.map((sale) => (
                        <tr key={sale.lot_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">#S-{sale.lot_id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">{sale.lot_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">Property {sale.property_id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">{sale.area_sqm ?? "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
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
        </>
      )}
    </div>
  );
};

export default MySales;
