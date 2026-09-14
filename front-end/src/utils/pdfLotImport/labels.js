import { transformPoint, yieldToBrowser } from "./paths.js";
import { containsPoint } from "./geometry.js";

const LOT = /^LOT\s*(?:NO\.?\s*)?[#.:-]?\s*(\d+[A-Z]?(?:[-/]\d+[A-Z]?)?)(?:[^\d\w].*)?$/i;
const BLOCK = /^(?:BLOCK|BLK\.?)\s*[#.:-]?\s*(\d+[A-Z]?)\s*$/i;
const AREA = /^(?:A(?:REA)?\s*[=:]\s*)([\d,]+(?:\.\d+)?)\s*(?:SQ\.?\s*M\.?|M[²2])?\s*$/i;
const NON_LOT = /\b(?:ROAD|RD\s+LOT|PARKS?\b|PLAYGROUND|EXCLUDED|FACILIT(?:Y|IES)|COMMUNIT(?:Y|IES|ES)|EASEMENT|OPEN\s+SPACE)\b/i;

export function classifyNonSaleable(text) {
  if (/\b(?:PARKS?\b|PLAYGROUND|P\s*&\s*PG)\b/i.test(text)) return { category: "park", label: "Park & Playground" };
  if (/\b(?:FACILIT(?:Y|IES)|COMMUNIT(?:Y|IES|ES)|COM\.?\s*&?\s*FAC(?:T)?\.?)\b/i.test(text)) return { category: "facility", label: "Community Facility" };
  if (/\b(?:EXCLUDED)\b|^EX$/i.test(text)) return { category: "excluded", label: "Excluded Area" };
  if (/\b(?:EASEMENT|OPEN\s+SPACE)\b/i.test(text)) return { category: "open_space", label: "Open Space / Easement" };
  if (/\b(?:ROAD|RD\s+LOT)\b/i.test(text)) return { category: "road", label: "Subdivision Road" };
  return null;
}

function decodeCadText(value) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (code === 3) return " ";
    return code >= 14 && code <= 96 ? String.fromCharCode(code + 30) : character;
  }).join("");
}

function separateNumericRuns(items) {
  return items.flatMap((item) => {
    // PDF.js may combine neighbouring parcels' numbers on one baseline ("8 80").
    // Digit advances are approximately equal in CAD fonts; keep the reconstructed
    // positions marked for review and require a spatial lot/area pair afterwards.
    if (!/^\d+(?:\.\d+)?(?: +\d+(?:\.\d+)?){1,3}$/.test(item.str || "") || !item.transform || !item.width) return [item];
    const weight = (str) => [...str].reduce((sum, char) => sum + (char === " " || char === "." ? 0.5 : 1), 0);
    const total = weight(item.str), [a, b] = item.transform, length = Math.hypot(a, b) || 1;
    return [...item.str.matchAll(/\d+(?:\.\d+)?/g)].map((match) => {
      const advance = item.width * weight(item.str.slice(0, match.index)) / total;
      const transform = [...item.transform];
      transform[4] += a / length * advance;
      transform[5] += b / length * advance;
      return { ...item, str: match[0], width: item.width * weight(match[0]) / total, transform, splitNumericRun: true };
    });
  });
}

export function extractLabels(textContent, viewport) {
  const fontEvidence = new Map();
  for (const item of textContent.items) {
    if (!item.str || !item.fontName) continue;
    const evidence = fontEvidence.get(item.fontName) || { lots: 0, areas: 0 };
    const decoded = decodeCadText(item.str).trim();
    if (item.str.includes(String.fromCharCode(3)) && LOT.test(decoded)) evidence.lots += 1;
    if (item.str.includes(String.fromCharCode(31)) && AREA.test(decoded)) evidence.areas += 1;
    fontEvidence.set(item.fontName, evidence);
  }
  // A missing ToUnicode table is common in CAD PDFs. Apply this known encoding only
  // after repeated lot AND area signatures agree within the same font, never globally.
  const recoveredFonts = new Set([...fontEvidence].filter(([, value]) => value.lots >= 3 && value.areas >= 3).map(([key]) => key));
  const labels = [];
  for (const item of separateNumericRuns(textContent.items)) {
    if (!item.str || !item.transform || !item.height || !item.width) continue;
    const recovered = recoveredFonts.has(item.fontName);
    const text = (recovered ? decodeCadText(item.str) : item.str).trim();
    if (!text) continue;
    const [a, b, c, d, x, y] = item.transform;
    const length = Math.hypot(a, b) || 1;
    const point = transformPoint(viewport.transform, [x + a / length * item.width / 2 + c * 0.35,
      y + b / length * item.width / 2 + d * 0.35]);
    const explicitBlock = text.match(BLOCK)?.[1] || "";
    const parenBlock = text.match(/[(>[](\d+[A-Z]?(?:[-Ä/][A-Z0-9]+)?)[)\]]?/i)?.[1]?.replace(/Ä/g, "-") || "";
    const nonSaleable = classifyNonSaleable(text);
    // Tag bare standalone numbers for numeric-mode fallback (CAD plans that use
    // "1", "100" instead of "LOT 1", "A=100 SQ.M.")
    const bareMatch = text.match(/^(\d[\d,]*(?:\.\d+)?)$/);
    labels.push({ text, point, recovered, lotNumber: text.match(LOT)?.[1] || "",
      block: explicitBlock || parenBlock, areaSqm: text.match(AREA) ? Number(text.match(AREA)[1].replace(/,/g, "")) : null,
      excluded: NON_LOT.test(text),
      nonSaleableCategory: nonSaleable?.category || null,
      nonSaleableLabel: nonSaleable?.label || null,
      bareValue: bareMatch ? Number(bareMatch[1].replace(/,/g, "")) : null,
      height: item.height, splitNumericRun: Boolean(item.splitNumericRun),
      // Text-down direction after the PDF page rotation, for stacked lot/area labels.
      down: (() => { const origin = transformPoint(viewport.transform, [x, y]);
        const up = transformPoint(viewport.transform, [x + c, y + d]);
        const size = Math.hypot(up[0] - origin[0], up[1] - origin[1]) || 1;
        return [(origin[0] - up[0]) / size, (origin[1] - up[1]) / size]; })() });
  }
  return { labels, recoveredFonts: recoveredFonts.size };
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export async function associateBlockLabels(candidates, labels, faces = candidates.map((candidate) => candidate.points)) {
  const blocks = labels.filter((label) => label.block);
  if (!blocks.length) {
    for (const candidate of candidates) candidate.warnings.push("Block number was not detected; enter it before creating this lot.");
    return;
  }
  const faceCandidates = new Map(candidates.map((candidate) => [candidate.points, candidate]));
  // Block labels often sit inside a park or an excluded parcel. Keep those faces in
  // the adjacency graph so the surrounding lots can inherit their printed block.
  const groups = [];
  for (let i = 0; i < faces.length; i += 1) {
    if (i % 50 === 0) await yieldToBrowser();
    const points = faces[i];
    const inside = labels.filter((label) => containsPoint(points, label.point));
    if (!inside.some((label) => /\b(?:ROAD|RD\s+LOT)\b|\b\d+(?:\.\d+)?\s*M\.?\s*W\.?/i.test(label.text))) {
      groups.push({ points, candidate: faceCandidates.get(points), labels: inside });
    }
  }
  const edges = new Map();
  const neighbors = groups.map(() => new Set());
  groups.forEach((group, index) => {
    group.points.forEach((point, offset) => {
      const next = group.points[(offset + 1) % group.points.length];
      const key = [point.join(","), next.join(",")].sort().join(":");
      for (const previous of edges.get(key) || []) { neighbors[index].add(previous); neighbors[previous].add(index); }
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(index);
    });
  });
  const segmentDistance = (point, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  };
  for (const label of blocks.filter((item) => item.blockSymbol)) {
    let nearest = null, best = Infinity;
    for (const group of groups) {
      const distanceToFace = containsPoint(group.points, label.point) ? 0 : Math.min(...group.points.map((point, i) => segmentDistance(label.point, point, group.points[(i + 1) % group.points.length])));
      if (distanceToFace < best) { best = distanceToFace; nearest = group; }
    }
    if (nearest && best < (label.symbolRadius || 5) * 3 && !nearest.labels.includes(label)) nearest.labels.push(label);
  }
  const visited = new Set();
  groups.forEach((group, index) => {
    if (visited.has(index)) return;
    const component = []; const pending = [index];
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current); component.push(groups[current]);
      for (const neighbor of neighbors[current]) pending.push(neighbor);
    }
    const lots = component.map((face) => face.candidate).filter(Boolean);
    if (!lots.length) return;
    const contained = component.flatMap((face) => face.labels.filter((label) => label.block));
    const unique = [...new Set(contained.map((block) => block.block))];
    for (const lot of lots) {
      if (lot.block) continue;
      if (unique.length === 1) {
        lot.block = unique[0];
        lot.warnings.push("Block number was matched through adjoining plan boundaries; verify it.");
      } else if (unique.length > 1) {
        const nearest = [...contained].sort((a, b) => distance(lot.labelPoint, a.point) - distance(lot.labelPoint, b.point))[0];
        lot.block = nearest.block;
        lot.warnings.push("Several block labels share adjoining boundaries; verify the suggested block number.");
      } else {
        lot.warnings.push("No block label is enclosed by this group of lots; enter its block number.");
      }
    }
  });
}
