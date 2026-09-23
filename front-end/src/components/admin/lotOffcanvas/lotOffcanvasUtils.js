export const checkIsNonSaleable = (num = "", area = 0) => {
  const text = String(num || "").toLowerCase().trim();
  return (
    text.includes("park") ||
    text.includes("playground") ||
    text.includes("facility") ||
    text.includes("clubhouse") ||
    text.includes("excluded") ||
    text.includes("open space") ||
    text.includes("easement") ||
    text.includes("community") ||
    text.includes("p & pg") ||
    text.includes("amenity") ||
    text.includes("common") ||
    text.includes("non-saleable") ||
    text.includes("non saleable")
  );
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
