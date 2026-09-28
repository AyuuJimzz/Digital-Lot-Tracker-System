export const NON_SALEABLE_REGEX = /\b(park|playground|facility|clubhouse|excluded|open\s+space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s+saleable)\b/i;

export const checkIsNonSaleable = (num = "", area = 0) => {
  return NON_SALEABLE_REGEX.test(String(num || ""));
};

export const stripNonSaleableTags = (numStr) => {
  return String(numStr || "")
    .replace(
      /\s*\([^)]*(?:park|playground|facility|clubhouse|excluded|open\s*space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s*saleable)[^)]*\)/gi,
      ""
    )
    .replace(
      /\s+(?:park|playground|facility|clubhouse|excluded\s*area|open\s*space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s*saleable)\b/gi,
      ""
    )
    .trim();
};

export const getStatusColorClasses = (status) => {
  switch (status) {
    case "Available":
      return "border-emerald-500 text-emerald-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 hover:border-emerald-400";
    case "Pending":
      return "border-amber-500 text-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 hover:border-amber-400";
    case "Sold":
      return "border-red-500 text-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/25 hover:border-red-400";
    default:
      return "border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 hover:border-gray-400";
  }
};
