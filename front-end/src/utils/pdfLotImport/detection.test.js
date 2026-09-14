import { detectPdfLots } from "./index";
import { extractSegments } from "./paths";
import { containsPoint, reconstructFaces, signedArea, cleanPolygonSpurs, bridgeDashedSegments } from "./geometry";
import { extractLabels, associateBlockLabels } from "./labels";
import { resolveBlockSymbols, pairNumericLabels } from "./planSymbols";

const OPS = Object.fromEntries(["save", "restore", "transform", "setDash", "setGState", "clip", "eoClip",
  "paintFormXObjectBegin", "paintFormXObjectEnd", "beginGroup", "constructPath", "moveTo", "lineTo", "curveTo",
  "curveTo2", "curveTo3", "closePath", "rectangle", "stroke", "closeStroke", "fillStroke", "eoFillStroke",
  "closeFillStroke", "closeEOFillStroke", "fill", "eoFill", "endPath"].map((name, i) => [name, i + 1]));
const viewport = { width: 200, height: 100, transform: [1, 0, 0, 1, 0, 0] };
const square = (x, y, size = 20) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
const lines = (points) => points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));
const operators = (entries) => ({ fnArray: entries.map(([fn]) => OPS[fn]), argsArray: entries.map(([, args]) => args || null) });
const rectangle = (x, y, width = 20, height = 20) => ["constructPath", [[OPS.rectangle], [x, y, width, height]]];
const text = (str, x, y, fontName = "plain") => ({ str, width: 8, height: 2, transform: [2, 0, 0, 2, x - 4, y - 0.7], fontName });
const cad = (str) => Array.from(str, (c) => c === " " ? String.fromCharCode(3) : String.fromCharCode(c.charCodeAt(0) - 30)).join("");

test("reconstructs shared boundaries at a T junction without merging two lots", async () => {
  const faces = await reconstructFaces([...lines(square(0, 0)), { a: [10, 0.08], b: [10, 20] }]);
  expect(faces).toHaveLength(2);
  expect(faces.every((points) => Math.abs(signedArea(points) - 200) < 2)).toBe(true);
  expect(faces.filter((points) => containsPoint(points, [5, 10]))).toHaveLength(1);
  expect(faces.filter((points) => containsPoint(points, [15, 10]))).toHaveLength(1);
});

test("an open boundary is never completed with an invented edge", async () => {
  const faces = await reconstructFaces(lines(square(0, 0)).slice(0, 3));
  expect(faces).toEqual([]);
});

test("applies page rotation and graphics transform but ignores filled text and dash guides", async () => {
  const ops = operators([["save"], ["transform", [2, 0, 0, 2, 10, 5]], rectangle(0, 0, 10, 10), ["stroke"], ["restore"],
    rectangle(70, 10), ["fill"], ["setDash", [[2, 2], 0]], rectangle(100, 10), ["stroke"]]);
  const segments = await extractSegments(ops, OPS, { width: 100, height: 200, transform: [0, 1, -1, 0, 100, 0] });
  expect(segments).toHaveLength(4);
  expect(segments[0]).toMatchObject({ a: [95, 10], b: [95, 30], curved: false });
});

test("does not import invisible strokes or strokes outside a rectangular crop", async () => {
  const ops = operators([rectangle(0, 0, 30, 30), ["clip"], ["endPath"], rectangle(5, 5), ["stroke"],
    rectangle(50, 5), ["stroke"], ["setGState", [[["CA", 0]]]], rectangle(6, 6), ["stroke"]]);
  expect(await extractSegments(ops, OPS, viewport)).toHaveLength(4);
});

test("fails clearly for unsupported clipping and oversized operator lists", async () => {
  const triangle = operators([["constructPath", [[OPS.moveTo, OPS.lineTo, OPS.lineTo, OPS.closePath], [0, 0, 20, 0, 10, 20]]], ["clip"]]);
  await expect(extractSegments(triangle, OPS, viewport)).rejects.toThrow(/clipping/i);
  await expect(extractSegments({ fnArray: Array(200001).fill(OPS.save), argsArray: [] }, OPS, viewport)).rejects.toThrow(/too complex/i);
});

test("CAD recovery needs repeated lot and area evidence in the same font", () => {
  const items = [text(cad("Lot 1"), 10, 10, "cad")];
  expect(extractLabels({ items }, viewport).labels[0].lotNumber).toBe("");
  for (let i = 1; i <= 3; i += 1) items.push(text(cad(`Lot ${i}`), i * 10, 10, "cad"), text(cad("A=120"), i * 10, 15, "cad"));
  items.push(text("Lot 98", 150, 20), text("A=500", 150, 25));
  const result = extractLabels({ items }, viewport);
  expect(result.recoveredFonts).toBe(1);
  expect(result.labels[0]).toMatchObject({ lotNumber: "1", recovered: true });
  expect(result.labels.find((label) => label.lotNumber === "98").recovered).toBe(false);
  expect(result.labels.filter((label) => label.areaSqm === 120)).toHaveLength(3);
});

test("inherits a printed block through an adjoining reserved parcel without importing it", async () => {
  const points = square(0, 0);
  const reserved = square(20, 0);
  const candidates = [{ points, labelPoint: [10, 10], block: "", warnings: [] }];
  await associateBlockLabels(candidates, [{ point: [30, 10], block: "8", text: "Block 8" }], [points, reserved]);
  expect(candidates[0].block).toBe("8");
});

test("detects labelled lots and non-saleables; excludes table cells, roads, and multi-lot faces", async () => {
  const ops = operators([rectangle(0, 0), ["stroke"], rectangle(30, 0), ["stroke"], rectangle(60, 0), ["stroke"],
    rectangle(90, 0), ["stroke"], rectangle(120, 0), ["stroke"]]);
  const items = [text("Lot 1", 10, 7), text("A=200", 10, 13), text("Block 2", 10, 17),
    text("120", 40, 10), text("Lot 2", 70, 7), text("ROAD LOT 1", 70, 15),
    text("Lot 3", 100, 7), text("Parks and Playground", 100, 15),
    text("Lot 4", 130, 7), text("Lot 5", 130, 14)];
  const page = { getViewport: () => viewport, getOperatorList: async () => ops, getTextContent: async () => ({ items }) };
  const result = await detectPdfLots(page, { OPS });
  expect(result.candidates).toHaveLength(2);
  expect(result.candidates[0]).toMatchObject({ lotNumber: "1", block: "2", areaSqm: 200, selected: false, nonSaleable: false });
  expect(result.candidates[0].points).toEqual([[0, 0], [0.1, 0], [0.1, 0.2], [0, 0.2]]);
  expect(result.candidates[1]).toMatchObject({ lotNumber: "3", category: "park", nonSaleable: true, selected: false });
  expect(result.warnings.some((warning) => warning.includes("non-saleable area(s) detected"))).toBe(true);
  expect(result.warnings.some((warning) => warning.includes("could not be matched"))).toBe(true);
});

test("a scanned page returns an honest manual-tracing message and no polygons", async () => {
  const result = await detectPdfLots({ getViewport: () => viewport, getOperatorList: async () => operators([]),
    getTextContent: async () => ({ items: [] }) }, { OPS });
  expect(result.candidates).toEqual([]);
  expect(result.warnings[0]).toMatch(/Scanned\/image PDFs/);
});

test("prunes dead-end CAD spurs so lots with minor line spikes form clean simple polygons", () => {
  const withSpur = [[0, 0], [10, 0], [10, 10], [5, 10], [5, 15], [5, 10], [0, 10]];
  const cleaned = cleanPolygonSpurs(withSpur);
  expect(cleaned).toEqual([[0, 0], [10, 0], [10, 10], [5, 10], [0, 10]]);
});

test("repairs short CAD divider gaps along an existing line but leaves long gaps open", async () => {
  for (const gap of [0.3, 0.6, 1.1]) {
    const faces = await reconstructFaces([...lines(square(0, 0, 50)), { a: [25, gap], b: [25, 50] }]);
    expect(faces).toHaveLength(2);
    expect(faces.every((points) => Math.abs(signedArea(points) - 1250) < 1)).toBe(true);
  }
  const faces = await reconstructFaces([...lines(square(0, 0, 50)), { a: [25, 4], b: [25, 50] }]);
  expect(faces).toHaveLength(1);
});

test("nearby unrelated endpoints are not bridged diagonally", () => {
  const segments = [{ a: [0, 0], b: [10, 0] }, { a: [10.8, 0.8], b: [10.8, 10] }];
  expect(bridgeDashedSegments(segments)).toHaveLength(2);
  expect(bridgeDashedSegments([{ a: [0, 0], b: [10, 0] }, { a: [11, 0], b: [20, 0] }])).toHaveLength(3);
});

const circleSegments = (x, y, radius, pathId) => lines(Array.from({ length: 32 }, (_, i) =>
  [x + radius * Math.cos(i * Math.PI / 16), y + radius * Math.sin(i * Math.PI / 16)]))
  .map((segment) => ({ ...segment, curved: true, pathId }));

test("restores a junction hidden by an offset block circle without bending straight dividers", async () => {
  const labels = [{ point: [20.7, 20], bareValue: 8, lotNumber: "", block: "" }];
  const circle = circleSegments(20.7, 20, 4, 1);
  const segments = [...lines(square(0, 0, 40)), ...circle,
    { a: [0, 20], b: [16.7, 20] }, { a: [24.7, 20], b: [40, 20] },
    { a: [20, 0], b: [20, 16.06] }, { a: [20, 23.94], b: [20, 40] }];
  const resolved = resolveBlockSymbols(segments, labels);
  expect(resolved.restored).toBe(4);
  expect(labels[0]).toMatchObject({ blockSymbol: true, block: "8", lotNumber: "" });
  const faces = await reconstructFaces(resolved.segments);
  expect(faces).toHaveLength(4);
  expect(faces.every((points) => Math.abs(signedArea(points) - 400) < 0.01)).toBe(true);
  const realCurve = circleSegments(75, 20, 15, 2);
  expect(resolveBlockSymbols(realCurve, []).segments).toHaveLength(32);
});

test("keeps curved parcel edges and straight subpaths sharing a paint operation", async () => {
  const ops = operators([["constructPath", [[OPS.moveTo, OPS.lineTo, OPS.curveTo, OPS.lineTo, OPS.closePath],
    [0, 0, 20, 0, 25, 5, 25, 15, 20, 20, 0, 20]]], rectangle(40, 0), ["stroke"]]);
  const segments = await extractSegments(ops, OPS, viewport);
  expect(segments.filter((s) => !s.curved)).toHaveLength(4);
  const page = { getViewport: () => viewport, getOperatorList: async () => ops,
    getTextContent: async () => ({ items: [text("Lot 1", 10, 10), text("A=100", 10, 15), text("Lot 2", 50, 10), text("A=110", 50, 15)] }) };
  const result = await detectPdfLots(page, { OPS });
  expect(result.candidates).toHaveLength(2);
  expect(result.candidates[0].points.some(([x]) => x > 0.1)).toBe(true);
});

test.each([0, Math.PI / 6, Math.PI / 2])("pairs small printed areas in the text orientation (%s radians)", (angle) => {
  const down = [Math.sin(angle), Math.cos(angle)];
  const labels = [80, 91, 98, 107].flatMap((area, i) => {
    const point = [20 + i * 40, 10];
    return [{ bareValue: i + 1, point, height: 4, down },
      { bareValue: area, point: [point[0] + down[0] * 4, point[1] + down[1] * 4], height: 4, down }];
  });
  expect(pairNumericLabels(labels)).toHaveLength(4);
  expect(labels.filter((label) => label.lotNumber).map((label) => label.lotNumber)).toEqual(["1", "2", "3", "4"]);
  expect(labels.filter((label) => label.areaSqm).map((label) => label.areaSqm)).toEqual([80, 91, 98, 107]);
});

test("never creates one numeric lot from an enclosure with several lot/area pairs", async () => {
  const items = [5, 15, 25].flatMap((x, i) => [text(String(i + 1), x, 12), text("80", x, 10)]);
  const page = { getViewport: () => viewport,
    getOperatorList: async () => operators([rectangle(0, 0, 30, 20), ["stroke"]]), getTextContent: async () => ({ items }) };
  const result = await detectPdfLots(page, { OPS });
  expect(result.candidates).toEqual([]);
  expect(result.warnings.join(" ")).toContain("3 lot labels could not be matched");
});

test("lot numbers can be larger than their printed square-metre areas", () => {
  const labels = [80, 90, 100].flatMap((area, i) => [
    { bareValue: 101 + i, point: [i * 30, 10], height: 4, down: [0, 1] },
    { bareValue: area, point: [i * 30, 14], height: 4, down: [0, 1] },
  ]);
  expect(pairNumericLabels(labels)).toHaveLength(3);
  expect(labels.filter((label) => label.lotNumber).map((label) => label.lotNumber)).toEqual(["101", "102", "103"]);
});

test("removes connected summary cells without removing parcels beside the table", async () => {
  const page = { getViewport: () => viewport,
    getOperatorList: async () => operators([rectangle(0, 0), ["stroke"], rectangle(0, 20), ["stroke"], rectangle(40, 20), ["stroke"]]),
    getTextContent: async () => ({ items: [text("SUMMARY", 10, 10), text("Lot 99", 10, 27), text("A=100", 10, 33),
      text("Lot 1", 50, 27), text("A=80", 50, 33)] }) };
  expect((await detectPdfLots(page, { OPS })).candidates.map((candidate) => candidate.lotNumber)).toEqual(["1"]);
});

test("separates joined PDF numeric runs and marks approximate positions for review", () => {
  const labels = extractLabels({ items: [{ ...text("8 80", 20, 10), width: 14, transform: [4, 0, 0, 4, 10, 10] }] }, viewport).labels;
  expect(labels.map((label) => label.bareValue)).toEqual([8, 80]);
  expect(labels.every((label) => label.splitNumericRun)).toBe(true);
  expect(labels[0].point[0]).toBeLessThan(labels[1].point[0]);
});

test("matches a block marker just outside its parcel group", async () => {
  const points = square(0, 0);
  const candidates = [{ points, labelPoint: [10, 10], block: "", warnings: [] }];
  await associateBlockLabels(candidates, [{ point: [-4, 10], block: "7", text: "7", blockSymbol: true, symbolRadius: 3 }], [points]);
  expect(candidates[0].block).toBe("7");
});
