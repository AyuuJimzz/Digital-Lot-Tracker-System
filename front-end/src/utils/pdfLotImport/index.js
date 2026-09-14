import { extractSegments, yieldToBrowser } from "./paths.js";
import { reconstructFaces, containsPoint, signedArea } from "./geometry.js";
import { extractLabels, associateBlockLabels, classifyNonSaleable } from "./labels.js";
import { findTableFaces } from "./tableRegions.js";
import { resolveBlockSymbols, pairNumericLabels } from "./planSymbols.js";
import { PDF_LOT_DETECTOR_VERSION } from "./version.js";

/** Detect reviewable lot polygons from PDF.js 2.x vector paths. Never creates records. */
export async function detectPdfLots(page, pdfjs) {
  if (!page?.getOperatorList || !pdfjs?.OPS) throw new Error("The PDF detector is unavailable. Re-upload the original PDF.");
  const viewport = page.getViewport({ scale: 1 });
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("The PDF has invalid page dimensions.");
  }
  const [operatorList, textContent] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
  const { labels, recoveredFonts } = extractLabels(textContent, viewport);
  if (labels.length > 15000) throw new Error("This page contains too many labels. Split the plan into smaller PDF pages.");
  const allSegments = await extractSegments(operatorList, pdfjs.OPS, viewport);
  const { segments, restored } = resolveBlockSymbols(allSegments, labels);
  const numericPairs = pairNumericLabels(labels);
  const numericMode = numericPairs.length > 0;
  const lotLabels = labels.filter((label) => label.lotNumber);
  const warnings = [];
  if (restored) warnings.push(`${restored} boundary endpoints were continued beneath numbered block symbols. Verify these junctions against the plan.`);

  if (!lotLabels.length || !segments.length) {
    return { detectorVersion: PDF_LOT_DETECTOR_VERSION, candidates: [], pageWidth: viewport.width, pageHeight: viewport.height, warnings: [
      "No readable lot labels with vector boundaries were found. Scanned/image PDFs need manual tracing or a clearer vector PDF.",
    ] };
  }
  if (lotLabels.length > 2000 || labels.length > 15000) throw new Error("This page contains too many labels. Split the plan into smaller PDF pages.");
  const faces = await reconstructFaces(segments);
  if (faces.length * labels.length > 3000000) throw new Error("Too many boundaries and labels to match safely. Split the subdivision plan into smaller pages.");
  const tableFaces = findTableFaces(faces, labels);
  const planFaces = faces.filter((points) => !tableFaces.has(points));
  const candidates = [];
  for (let index = 0; index < faces.length; index += 1) {
    if (index % 100 === 0) await yieldToBrowser();
    const points = faces[index];
    if (tableFaces.has(points)) continue;
    const drawingArea = signedArea(points);
    if (new Set(points.map((point) => point.join(","))).size !== points.length ||
      points.length > 200 || drawingArea > viewport.width * viewport.height * 0.08 ||
      points.some(([x, y]) => x < 0 || y < 0 || x > viewport.width || y > viewport.height)) continue;
    const inside = labels.filter((label) => containsPoint(points, label.point));
    const lotMatches = inside.filter((label) => label.lotNumber);
    const joinedCategory = classifyNonSaleable(inside.map((label) => label.text).join(" "));
    const categoryText = inside.find((label) => label.nonSaleableCategory && label.nonSaleableCategory !== "road");
    const nonSaleableMatch = categoryText || (joinedCategory && joinedCategory.category !== "road" ? {
      point: inside[0].point, nonSaleableCategory: joinedCategory.category, nonSaleableLabel: joinedCategory.label,
    } : null);
    const isRoad = inside.some((label) => label.nonSaleableCategory === "road" || /\b(?:ROAD|RD\s+LOT)\b/i.test(label.text));

    if (isRoad) continue;
    // A face containing multiple lot labels is a merged/ambiguous region.
    // Never turn an entire block into one parcel by choosing the smallest number.
    if (lotMatches.length > 1) continue;
    if (lotMatches[0]?.numericPair != null && !inside.some((label) => label.areaSqm && label.numericPair === lotMatches[0].numericPair)) continue;
    if (lotMatches.length === 0 && !nonSaleableMatch) continue;

    const isNonSaleable = Boolean(nonSaleableMatch);
    const category = nonSaleableMatch?.nonSaleableCategory || "residential";
    const categoryLabel = nonSaleableMatch?.nonSaleableLabel || "Residential Lot";

    const lotLabel = lotMatches[0];
    const lotNumber = lotLabel?.lotNumber || (category === "park" ? "PARK" : category === "facility" ? "FACILITY" : "EXCLUDED");
    const areas = [...new Set(inside.filter((label) => label.areaSqm > 0).map((label) => label.areaSqm))];
    if (!areas.length && isNonSaleable && !lotLabel) {
      const bareAreas = inside.filter((label) => label.bareValue >= 10 && !label.blockSymbol);
      if (bareAreas.length === 1) areas.push(bareAreas[0].bareValue);
    }
    const candidateWarnings = ["Review the detected boundary against the PDF before creating this lot."];
    if (isNonSaleable) {
      candidateWarnings.push(`Non-saleable area (${categoryLabel}). It is unselected by default.`);
    }
    if (lotLabel?.recovered || inside.some((label) => label.areaSqm && label.recovered)) {
      candidateWarnings.push("PDF font encoding was recovered automatically; verify the lot number and printed area.");
    }
    if (lotLabel?.numericPair != null) {
      candidateWarnings.push("Numeric-mode detection: lot number and area were inferred from bare numbers. Verify against the plan.");
    }
    if (inside.some((label) => label.splitNumericRun)) {
      candidateWarnings.push("Adjacent PDF numbers were separated using estimated text positions; verify this lot number and area.");
    }
    if (areas.length !== 1) candidateWarnings.push(areas.length ? "Several printed areas are inside this boundary; enter the correct area." : "Printed area was not detected; enter the area from the plan.");
    candidates.push({ id: `pdf-lot-${index + 1}`, points, labelPoint: lotLabel?.point || nonSaleableMatch.point, lotNumber,
      block: lotLabel?.block || inside.find((l) => l.block)?.block || "", areaSqm: areas.length === 1 ? areas[0] : null,
      selected: false, category, categoryLabel, nonSaleable: isNonSaleable, warnings: candidateWarnings });
  }
  await associateBlockLabels(candidates, labels, planFaces);
  const identities = new Map();
  for (const candidate of candidates) {
    const identity = `${candidate.block}:${candidate.lotNumber}`;
    if (!identities.has(identity)) identities.set(identity, []);
    identities.get(identity).push(candidate);
  }
  for (const duplicates of identities.values()) if (duplicates.length > 1) {
    for (const candidate of duplicates) candidate.warnings.push("Another candidate has this block and lot number; correct the duplicate before creating it.");
  }
  const unresolvedBlocks = candidates.filter((candidate) => !candidate.block).length;
  const duplicateLabels = [...identities.values()].filter((items) => items.length > 1).reduce((sum, items) => sum + items.length, 0);
  if (unresolvedBlocks) warnings.push(`${unresolvedBlocks} candidate${unresolvedBlocks === 1 ? " needs" : "s need"} a block number entered from the plan.`);
  if (duplicateLabels) warnings.push(`${duplicateLabels} candidates share a suggested block and lot number. Correct those identities before bulk creation.`);
  if (recoveredFonts) warnings.push("Some PDF text uses a custom CAD font. Recovered labels are suggestions and must be checked against the visible plan.");
  const nonSaleableCount = candidates.filter((c) => c.nonSaleable).length;
  if (nonSaleableCount > 0) {
    warnings.push(`${nonSaleableCount} non-saleable area(s) detected (parks, facilities, excluded areas). They are unselected by default.`);
  }
  if (numericMode) {
    warnings.push("Numeric-mode detection was used: this plan has bare numbers instead of labeled lot/area text. All lot numbers and areas should be verified against the visible PDF.");
  }
  const omitted = lotLabels.filter((label) => !candidates.some((candidate) => candidate.labelPoint === label.point)).length;
  if (omitted > 0) warnings.push(`${omitted} lot label${omitted === 1 ? "" : "s"} could not be matched to one clear enclosed lot. These may be open boundaries or labels outside a parcel; trace them manually if needed.`);
  warnings.push("Align the plan first, then review and select lots to create. Roads and unlabelled shapes are skipped.");
  return { detectorVersion: PDF_LOT_DETECTOR_VERSION, candidates: candidates.map(({ labelPoint, ...candidate }) => ({ ...candidate,
    points: candidate.points.map(([x, y]) => [x / viewport.width, y / viewport.height]),
  })), warnings, pageWidth: viewport.width, pageHeight: viewport.height };
}
