export const getAuthConfig = () => {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

export const STATUS_COLORS = {
  Available: "#22c55e",
  Pending: "#eab308",
  Sold: "#ef4444",
  NonSaleable: "#64748b",
};

export const isNonSaleableLot = (lotOrNumber = "", areaSqm = 0) => {
  if (lotOrNumber && typeof lotOrNumber === "object") {
    if (
      lotOrNumber.is_non_saleable !== undefined &&
      lotOrNumber.is_non_saleable !== null
    ) {
      return Number(lotOrNumber.is_non_saleable) === 1;
    }
    if (lotOrNumber.nonSaleable !== undefined && lotOrNumber.nonSaleable !== null) {
      return Boolean(lotOrNumber.nonSaleable);
    }
    if (lotOrNumber._nonSaleable !== undefined && lotOrNumber._nonSaleable !== null) {
      return Boolean(lotOrNumber._nonSaleable);
    }
    lotOrNumber = lotOrNumber.lot_number || "";
  }
  return /\b(park|playground|facility|clubhouse|excluded|open\s+space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s+saleable)\b/i.test(
    String(lotOrNumber || "")
  );
};

export const getStatusColor = (status, lotOrNumber = "", areaSqm = 0) => {
  if (isNonSaleableLot(lotOrNumber, areaSqm)) {
    return STATUS_COLORS.NonSaleable;
  }
  return STATUS_COLORS[status] || "#94a3b8";
};
