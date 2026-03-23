import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const getStatusClass = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();
  if (normalizedStatus === "sold") return "bg-green-100 text-green-800";
  if (normalizedStatus === "pending") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
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
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Lot Updates</h3>

      {!loading && !error && items.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search lot id, lot number, property, status"
            className="w-full lg:max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full sm:w-40 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>

            <select
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
              className="w-full sm:w-36 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
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

      {loading && <div className="text-sm text-gray-500">Loading recent updates...</div>}

      {!loading && error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-sm text-gray-500">No recent lot updates found.</div>
      )}

      {!loading && !error && items.length > 0 && sortedItems.length === 0 && (
        <div className="text-sm text-gray-500">No results match your search/filter.</div>
      )}

      {!loading && !error && sortedItems.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort("id")}
                      className="inline-flex items-center gap-1"
                    >
                      Lot ID <span>{getSortIndicator("id")}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort("lotNumber")}
                      className="inline-flex items-center gap-1"
                    >
                      Lot Number <span>{getSortIndicator("lotNumber")}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort("propertyId")}
                      className="inline-flex items-center gap-1"
                    >
                      Property <span>{getSortIndicator("propertyId")}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort("area")}
                      className="inline-flex items-center gap-1"
                    >
                      Area (sqm) <span>{getSortIndicator("area")}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="inline-flex items-center gap-1"
                    >
                      Status <span>{getSortIndicator("status")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{item.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.lotNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Property {item.propertyId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.area ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {firstResultIndex}–{lastResultIndex} of {sortedItems.length} results
            </span>

            <div className="flex items-center gap-2">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
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
