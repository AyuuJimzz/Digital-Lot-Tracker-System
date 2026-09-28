import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { isNonSaleableLot } from "../Admin/map/utils/mapConstants";

const ROWS_PER_PAGE = 10;
const EMPTY_LOTS = [];

const getStatusColor = (status) => {
  switch (status) {
    case "Available":    return "text-green-600 dark:text-green-400 font-semibold";
    case "Pending":      return "text-amber-500 dark:text-amber-400 font-semibold";
    case "Sold":         return "text-red-600 dark:text-red-400 font-semibold";
    case "Non-Saleable": return "text-slate-500 dark:text-slate-400 font-semibold";
    case "Cancelled":    return "text-slate-500 dark:text-slate-400 font-semibold";
    default:             return "text-gray-600 dark:text-slate-400 font-semibold";
  }
};

const inputCls = "w-full md:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors";
const selectCls = "w-full md:w-44 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors";
const paginBtnCls = "rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";

const MyProperties = () => {
  const lotsQuery = useQuery({
    queryKey: ["employee-lots"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const authConfig = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const [lotsResponse, propertiesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/lots/all`, authConfig),
        axios.get(`${API_BASE_URL}/api/properties`, authConfig),
      ]);
      const fetchedLots = Array.isArray(lotsResponse.data) ? lotsResponse.data : [];
      const fetchedProperties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];
      const propNameMap = new Map();
      fetchedProperties.forEach((property) => {
        propNameMap.set(Number(property.property_id), property.property_name || `Property ${property.property_id}`);
      });
      const activePropertyIds = new Set(
        fetchedProperties.filter((property) => property.status !== "inactive").map((property) => Number(property.property_id))
      );
      return fetchedLots
        .filter((lot) => activePropertyIds.has(Number(lot.property_id)))
        .map((lot) => {
          const nonSaleable = isNonSaleableLot(lot, lot.area_sqm);
          return {
            ...lot,
            property_name: propNameMap.get(Number(lot.property_id)) || `Property ${lot.property_id}`,
            is_non_saleable: nonSaleable,
            effective_status: nonSaleable ? "Non-Saleable" : (lot.status || "Available"),
          };
        });
    },
  });
  const lots = lotsQuery.data || EMPTY_LOTS;
  const loading = lotsQuery.isPending;
  const error = lotsQuery.error ? "Unable to load properties. Please try again." : "";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const propText = `${lot.property_name || ""} Property ${lot.property_id || ""}`.toLowerCase();
      const statusToDisplay = lot.effective_status || lot.status || "";
      const searchText = `${lot.lot_number} ${propText} ${lot.area_sqm} ${statusToDisplay}`.toLowerCase();
      const matchesSearch = searchTerm.trim() ? searchText.includes(searchTerm.trim().toLowerCase()) : true;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusToDisplay.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [lots, searchTerm, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / ROWS_PER_PAGE));
  const paginatedLots = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredLots.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredLots, currentPage]);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  if (loading) return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Properties</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400">Loading properties...</p>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Properties</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Browse and filter lots from the current inventory.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}<button type="button" onClick={() => lotsQuery.refetch()} className="ml-2 underline">Retry</button></div>}

      {(!error || lotsQuery.data) && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              id="employee-properties-search"
              name="employee_properties_search"
              aria-label="Search lot number or property"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search lot number, property..."
              className={inputCls}
            />
            <select
              id="employee-properties-status-filter"
              name="employee_properties_status_filter"
              aria-label="Filter property status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="non-saleable">Non-Saleable</option>
            </select>
          </div>

          {filteredLots.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">No properties match your current filter.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      {["Lot Number", "Property", "Area (sqm)", "Status"].map((col) => (
                        <th key={col} className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {paginatedLots.map((lot) => (
                      <tr key={lot.lot_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">{lot.lot_number}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-slate-200">{lot.property_name || `Property ${lot.property_id}`}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{lot.area_sqm ? `${lot.area_sqm} sqm` : "-"}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                          <span className={`text-xs ${getStatusColor(lot.effective_status || lot.status)}`}>
                            {lot.effective_status || lot.status || "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
                <span>Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredLots.length)} of {filteredLots.length}</span>
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

export default MyProperties;
