export const getAuthConfig = () => {
  const token = localStorage.getItem("authToken");
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

export const STATUS_COLORS = {
  Available: "#22c55e",
  Pending: "#eab308",
  Sold: "#ef4444",
  NonSaleable: "#64748b",
};

export const isNonSaleableLot = (lotNumber = "", areaSqm = 0) => {
  const num = String(lotNumber || "").toLowerCase().trim();
  return (
    num.includes("park") ||
    num.includes("playground") ||
    num.includes("facility") ||
    num.includes("clubhouse") ||
    num.includes("excluded") ||
    num.includes("open space") ||
    num.includes("easement") ||
    num.includes("community") ||
    num.includes("p & pg") ||
    num.includes("amenity") ||
    num.includes("common") ||
    num.includes("non-saleable") ||
    num.includes("non saleable")
  );
};

export const getStatusColor = (status, lotNumber = "", areaSqm = 0) => {
  if (isNonSaleableLot(lotNumber, areaSqm)) {
    return STATUS_COLORS.NonSaleable;
  }
  return STATUS_COLORS[status] || "#94a3b8";
};
