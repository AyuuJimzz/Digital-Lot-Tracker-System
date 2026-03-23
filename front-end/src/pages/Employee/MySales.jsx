import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ROWS_PER_PAGE = 10;

const MySales = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lots, setLots] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const sessionResponse = await axios.get("http://localhost:5000/api/auth/check-session", {
          withCredentials: true,
        });

        if (sessionResponse.data.role !== "employee" && sessionResponse.data.role !== "admin") {
          window.location.href = "/forbidden";
          return;
        }

        setIsAuthorized(true);

        const lotsResponse = await axios.get("http://localhost:5000/api/lots/all", {
          withCredentials: true,
        });

        const lotsData = Array.isArray(lotsResponse.data) ? lotsResponse.data : [];
        setLots(lotsData);
      } catch (requestError) {
        if (requestError?.response?.status === 401) {
          window.location.href = "/access-denied";
          return;
        }
        setError("Unable to load sales data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, []);

  const salesLots = useMemo(() => {
    return lots.filter((lot) => {
      const normalizedStatus = String(lot.status || "").toLowerCase();
      return normalizedStatus === "sold" || normalizedStatus === "pending";
    });
  }, [lots]);

  const soldCount = useMemo(() => {
    return salesLots.filter((lot) => String(lot.status || "").toLowerCase() === "sold").length;
  }, [salesLots]);

  const pendingCount = useMemo(() => {
    return salesLots.filter((lot) => String(lot.status || "").toLowerCase() === "pending").length;
  }, [salesLots]);

  const filteredSales = useMemo(() => {
    return salesLots.filter((lot) => {
      const normalizedStatus = String(lot.status || "").toLowerCase();
      const searchText =
        `${lot.lot_id} ${lot.lot_number} ${lot.property_id} ${lot.status} ${lot.area_sqm}`.toLowerCase();

      const matchesSearch = searchTerm.trim()
        ? searchText.includes(searchTerm.trim().toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" ? true : normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [salesLots, searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ROWS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredSales.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredSales, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Sales</h1>
        <p className="text-sm text-gray-500">Loading sales...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Sales</h1>
        <p className="text-sm text-gray-500 mt-2">Track sold and pending lot transactions.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Total Sales Records</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{salesLots.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Completed Sales</p>
              <p className="text-2xl font-semibold text-green-700 mt-2">{soldCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">Pending Sales</p>
              <p className="text-2xl font-semibold text-yellow-700 mt-2">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search lot id, lot number, property"
                className="w-full md:max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full md:w-40 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              >
                <option value="all">All Status</option>
                <option value="sold">Sold</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {filteredSales.length === 0 ? (
              <div className="text-sm text-gray-500">
                No sales records match your current filter.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sale Ref
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lot Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Property
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Area (sqm)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedSales.map((sale) => (
                        <tr key={sale.lot_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            #S-{sale.lot_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.lot_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Property {sale.property_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.area_sqm ?? "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.status ?? "Unknown"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
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
                      onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((previous) => Math.min(totalPages, previous + 1))
                      }
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
        </>
      )}
    </div>
  );
};

export default MySales;
