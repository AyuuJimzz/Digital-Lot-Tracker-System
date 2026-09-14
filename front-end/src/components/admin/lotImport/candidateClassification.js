export function changeCandidateClassification(candidate, nonSaleable) {
  const detectedClassification = candidate.detectedClassification || {
    nonSaleable: Boolean(candidate.nonSaleable),
    category: candidate.category || "residential",
    categoryLabel: candidate.categoryLabel || "Saleable Lot",
  };
  return {
    ...candidate,
    detectedClassification,
    nonSaleable,
    category: nonSaleable ? (detectedClassification.nonSaleable ? detectedClassification.category : "excluded") : "residential",
    categoryLabel: nonSaleable ? (detectedClassification.nonSaleable ? detectedClassification.categoryLabel : "Non-saleable Area") : "Saleable Lot",
    // A lot changed to non-saleable must be deliberately included again.
    selected: nonSaleable ? false : candidate.selected,
  };
}
