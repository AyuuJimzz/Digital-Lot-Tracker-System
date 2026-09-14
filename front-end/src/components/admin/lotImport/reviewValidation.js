export const getImportLotNumber = ({ block = "", lotNumber = "" }) => {
  const lot = String(lotNumber).trim();
  return String(block).trim() ? `Block ${String(block).trim()} Lot ${lot}` : lot;
};

const normalizeIdentifier = (value) => String(value).trim().replace(/\s+/g, " ").toLowerCase();
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

export function hasValidBoundary(points) {
  if (!Array.isArray(points) || points.length < 3 || points.some((point) => (
    !Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ))) return false;

  let signedArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    if (Math.hypot(points[i][0] - next[0], points[i][1] - next[1]) < 1e-9) return false;
    signedArea += points[i][0] * next[1] - next[0] * points[i][1];
    for (let j = i + 2; j < points.length; j += 1) {
      if (i === 0 && j === points.length - 1) continue;
      const other = points[(j + 1) % points.length];
      const first = cross(points[i], next, points[j]);
      const second = cross(points[i], next, other);
      const third = cross(points[j], other, points[i]);
      const fourth = cross(points[j], other, next);
      const boxesOverlap = Math.max(Math.min(points[i][0], next[0]), Math.min(points[j][0], other[0])) <= Math.min(Math.max(points[i][0], next[0]), Math.max(points[j][0], other[0])) + 1e-12
        && Math.max(Math.min(points[i][1], next[1]), Math.min(points[j][1], other[1])) <= Math.min(Math.max(points[i][1], next[1]), Math.max(points[j][1], other[1])) + 1e-12;
      if (boxesOverlap && first * second <= 0 && third * fourth <= 0) return false;
    }
  }
  return Math.abs(signedArea) > 1e-10;
}

export function getCandidateIssues(candidates, existingLotNumbers = []) {
  const existing = new Set(existingLotNumbers.map(normalizeIdentifier));
  const identifierGroups = new Map();
  candidates.forEach((candidate, index) => {
    if (!candidate.selected) return;
    const identifier = normalizeIdentifier(getImportLotNumber(candidate));
    if (!identifierGroups.has(identifier)) identifierGroups.set(identifier, []);
    identifierGroups.get(identifier).push({ id: candidate.id, number: index + 1 });
  });
  return new Map(candidates.map((candidate) => {
    const issues = [];
    const identifier = getImportLotNumber(candidate);
    if (!String(candidate.lotNumber || "").trim()) issues.push("Enter the lot number from the plan.");
    if (identifier.length > 50) issues.push("Block and lot identifier must be 50 characters or fewer.");
    if (!Number.isFinite(Number(candidate.areaSqm)) || Number(candidate.areaSqm) <= 0) issues.push("Enter a positive area in square meters.");
    if (existing.has(normalizeIdentifier(identifier))) issues.push("This lot identifier already exists in this property.");
    const matching = identifierGroups.get(normalizeIdentifier(identifier)) || [];
    if (candidate.selected && matching.length > 1) {
      const other = matching.find((item) => item.id !== candidate.id);
      issues.push(`Duplicate identifier among selected lots. Check the block and lot number (conflicts with Candidate ${other ? other.number : ""}).`);
    }
    if (!hasValidBoundary(candidate.points)) issues.push("Boundary is invalid. Correct crossing or overlapping corners, or exclude this lot.");
    return [candidate.id, issues];
  }));
}
