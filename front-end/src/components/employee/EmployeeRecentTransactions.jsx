import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const getStatusClass = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();
  if (normalizedStatus === "sold") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (normalizedStatus === "pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (normalizedStatus === "available") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  return "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300";
};

const EmployeeTransactions = ({ items = [], loading = false, error = "" }) => {
  const ROWS_PER_PAGE_OPTIONS = [5, 10, 20];
  const SORTABLE_COLUMNS = ["id", "lotNumber", "propertyId", "area", "status"];
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearchTerm = searchParams.get("q") || "";
  const initialStatusFilter = ["all", "available", "pending", "sold"].includes(
    searchParams.get("status") || "all"
  )
    ? searchParams.get("status") || "all"
    : "all";
  const parsedPerPage = Number(searchParams.get("perPage") || 5);
  const initialRowsPerPage = ROWS_PER_PAGE_OPTIONS.includes(parsedPerPage) ? parsedPerPage : 5;
  const parsedPage = Number(searchParams.get("page") || 1);
  const initialPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const initialSortKey = SORTABLE_COLUMNS.includes(searchParams.get("sort") || "id")
    ? searchParams.get("sort") || "id"
    : "id";
  const initialSortDirection = ["asc", "desc"].includes(searchParams.get("dir") || "desc")
    ? searchParams.get("dir") || "desc"
    : "desc";

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearchTerm);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortKey, setSortKey] = useState(initialSortKey);
  const [sortDirection, setSortDirection] = useState(initialSortDirection);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const searchText =
        `${item.id} ${item.lotNumber} ${item.propertyId} ${item.status} ${item.area}`.toLowerCase();

      const matchesSearch = debouncedSearchTerm.trim()
        ? searchText.includes(debouncedSearchTerm.trim().toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" ? true : status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, debouncedSearchTerm, statusFilter]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      const firstValue = a[sortKey];
      const secondValue = b[sortKey];

      const firstNumeric = Number(firstValue);
      const secondNumeric = Number(secondValue);
      const isNumericSort = Number.isFinite(firstNumeric) && Number.isFinite(secondNumeric);

      let comparison = 0;

      if (isNumericSort) {
        comparison = firstNumeric - secondNumeric;
      } else {
        comparison = String(firstValue ?? "").localeCompare(String(secondValue ?? ""));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredItems, sortKey, sortDirection]);

  const handleSort = (columnKey) => {
    if (sortKey === columnKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(columnKey);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getSortIndicator = (columnKey) => {
    if (sortKey !== columnKey) {
      return "↕";
    }
    return sortDirection === "asc" ? "↑" : "↓";
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedItems.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedItems, currentPage, rowsPerPage]);

  const firstResultIndex = sortedItems.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastResultIndex = Math.min(currentPage * rowsPerPage, sortedItems.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (debouncedSearchTerm.trim()) {
      nextParams.set("q", debouncedSearchTerm.trim());
    }

    if (statusFilter !== "all") {
      nextParams.set("status", statusFilter);
    }

    if (rowsPerPage !== 5) {
      nextParams.set("perPage", String(rowsPerPage));
    }

    if (currentPage > 1) {
      nextParams.set("page", String(currentPage));
    }

    if (sortKey !== "id") {
      nextParams.set("sort", sortKey);
    }

    if (sortDirection !== "desc") {
      nextParams.set("dir", sortDirection);
    }

    setSearchParams(nextParams, { replace: true });
  }, [
    debouncedSearchTerm,
    statusFilter,
    rowsPerPage,
    currentPage,
    sortKey,
    sortDirection,
    setSearchParams,
  ]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 transition-colors duration-300">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Lot Updates</h3>

      {!loading && !error && items.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search lot id, lot number, property, status"
            className="w-full lg:max-w-sm rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
          />

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full sm:w-40 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>

            <select
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
              className="w-full sm:w-36 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Loading recent updates...</div>}

      {!loading && error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-slate-400">No recent lot updates found.</div>
      )}

      {!loading && !error && items.length > 0 && sortedItems.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-slate-400">No results match your search/filter.</div>
      )}

      {!loading && !error && sortedItems.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
              <thead className="bg-gray-50/80 dark:bg-slate-800/80">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">
                    <button type="button" onClick={() => handleSort("id")} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Lot ID <span className="text-[10px] text-gray-400">{getSortIndicator("id")}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[28%]">
                    <button type="button" onClick={() => handleSort("lotNumber")} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Lot Number <span className="text-[10px] text-gray-400">{getSortIndicator("lotNumber")}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[27%]">
                    <button type="button" onClick={() => handleSort("propertyId")} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Property <span className="text-[10px] text-gray-400">{getSortIndicator("propertyId")}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell w-[15%]">
                    <button type="button" onClick={() => handleSort("area")} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Area (sqm) <span className="text-[10px] text-gray-400">{getSortIndicator("area")}</span>
                    </button>
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">
                    <button type="button" onClick={() => handleSort("status")} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Status <span className="text-[10px] text-gray-400">{getSortIndicator("status")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">#{item.id}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-slate-200">{item.lotNumber}</td>
                    <td className="px-4 py-3.5 text-gray-700 dark:text-slate-300">Property {item.propertyId}</td>
                    <td className="px-4 py-3.5 text-center text-gray-700 dark:text-slate-300 hidden sm:table-cell">{item.area ?? "-"}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
            <span>Showing {firstResultIndex}–{lastResultIndex} of {sortedItems.length} results</span>
            <div className="flex items-center gap-2">
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeTransactions;
