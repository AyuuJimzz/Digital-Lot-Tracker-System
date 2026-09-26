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
      return "border-green-500 text-green-600 focus:border-green-500 focus:ring-green-500";
    case "Pending":
      return "border-amber-500 text-amber-500 focus:border-amber-500 focus:ring-amber-500";
    case "Sold":
      return "border-red-500 text-red-600 focus:border-red-500 focus:ring-red-500";
    default:
      return "border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500";
  }
};
