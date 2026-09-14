const MAX_IMPORT_LOTS = 500;
const MAX_POLYGON_VERTICES = 200;
const MAX_LOT_NUMBER_LENGTH = 50;
const MAX_AREA_SQM = 99999999.99; // lots.area_sqm is DECIMAL(10, 2).
const GEOMETRY_EPSILON = 1e-16;
// Ignore slivers below 0.05 m² caused by PDF/satellite coordinate rounding.
// Shared edges and shared vertices have zero intersection area and remain valid.
const OVERLAP_TOLERANCE_SQM = 0.05;
const METRES_PER_DEGREE = Math.PI * 6371008.8 / 180;

class LotImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LotImportError";
    this.status = status;
  }
}

function normalizeLotNumber(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function pointKey(point) {
  // About a millimetre of precision: also catches insignificant round-off on retry.
  return point.map((value) => Number(value.toFixed(8))).join(",");
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return (
    Math.abs(cross(a, b, point)) <= GEOMETRY_EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - 1e-12 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-12 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > GEOMETRY_EPSILON && abD < -GEOMETRY_EPSILON) ||
      (abC < -GEOMETRY_EPSILON && abD > GEOMETRY_EPSILON)) &&
    ((cdA > GEOMETRY_EPSILON && cdB < -GEOMETRY_EPSILON) ||
      (cdA < -GEOMETRY_EPSILON && cdB > GEOMETRY_EPSILON))
  ) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function validatePolygon(value, label = "Lot") {
  if (!Array.isArray(value) || value.length < 3 || value.length > MAX_POLYGON_VERTICES + 1) {
    throw new LotImportError(`${label}: provide a polygon with 3–${MAX_POLYGON_VERTICES} vertices.`);
  }
  const coordinates = value.map((point) => {
    if (
      !Array.isArray(point) || point.length !== 2 ||
      !point.every((number) => typeof number === "number" && Number.isFinite(number)) ||
      Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180
    ) throw new LotImportError(`${label}: every coordinate must be a valid [latitude, longitude] pair.`);
    return [...point];
  });
  if (pointKey(coordinates[0]) === pointKey(coordinates[coordinates.length - 1])) coordinates.pop();
  if (coordinates.length < 3 || coordinates.length > MAX_POLYGON_VERTICES) {
    throw new LotImportError(`${label}: provide a polygon with 3–${MAX_POLYGON_VERTICES} distinct vertices.`);
  }
  const keys = coordinates.map(pointKey);
  if (new Set(keys).size !== coordinates.length) {
    throw new LotImportError(`${label}: the boundary contains repeated vertices.`);
  }
  // A translated shoelace sum avoids cancellation at small lot scales near longitude 122.
  let twiceArea = 0;
  const origin = coordinates[0];
  for (let i = 1; i < coordinates.length - 1; i++) {
    twiceArea += cross(origin, coordinates[i], coordinates[i + 1]);
  }
  if (Math.abs(twiceArea) <= GEOMETRY_EPSILON) {
    throw new LotImportError(`${label}: the boundary must enclose a nonzero area.`);
  }
  for (let i = 0; i < coordinates.length; i++) {
    const nextI = (i + 1) % coordinates.length;
    // Adjacent edges may meet at their shared vertex, but must not double back.
    const afterI = (i + 2) % coordinates.length;
    if (onSegment(coordinates[i], coordinates[nextI], coordinates[afterI]) ||
        onSegment(coordinates[nextI], coordinates[afterI], coordinates[i])) {
      throw new LotImportError(`${label}: the boundary doubles back on itself.`);
    }
    for (let j = i + 1; j < coordinates.length; j++) {
      const nextJ = (j + 1) % coordinates.length;
      if (j === nextI || nextJ === i) continue;
      if (segmentsIntersect(coordinates[i], coordinates[nextI], coordinates[j], coordinates[nextJ])) {
        throw new LotImportError(`${label}: the boundary intersects itself.`);
      }
    }
  }
  return coordinates;
}

function polygonKey(value) {
  let coordinates;
  try {
    coordinates = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(coordinates) || coordinates.length < 3 ||
        !coordinates.every((point) => Array.isArray(point) && point.length === 2 &&
          point.every((number) => typeof number === "number" && Number.isFinite(number)))) return null;
    coordinates = coordinates.map((point) => point.map((number) => Number(number.toFixed(8))));
    if (pointKey(coordinates[0]) === pointKey(coordinates[coordinates.length - 1])) coordinates.pop();
    // Redundant points along straight edges do not make a different lot boundary.
    let changed = true;
    while (changed && coordinates.length > 3) {
      changed = false;
      for (let i = 0; i < coordinates.length; i++) {
        if (onSegment(coordinates[(i + coordinates.length - 1) % coordinates.length],
          coordinates[(i + 1) % coordinates.length], coordinates[i])) {
          coordinates.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    if (coordinates.length < 3) return null;
    const keys = coordinates.map(pointKey);
    const start = keys.indexOf([...keys].sort()[0]);
    const forward = keys.slice(start).concat(keys.slice(0, start)).join(";");
    const reverse = [keys[start], ...keys.slice(0, start).reverse(), ...keys.slice(start + 1).reverse()].join(";");
    return forward < reverse ? forward : reverse;
  } catch (_) {
    return null; // Older point markers or malformed legacy records are not import candidates.
  }
}

function signedTwiceArea(points) {
  let result = 0;
  for (let i = 1; i < points.length - 1; i++) result += cross(points[0], points[i], points[i + 1]);
  return result;
}

function boundsOf(points) {
  return points.reduce((bounds, point) => [
    Math.min(bounds[0], point[0]), Math.min(bounds[1], point[1]),
    Math.max(bounds[2], point[0]), Math.max(bounds[3], point[1]),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function boundsOverlap(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function prepareGeometry(value) {
  let coordinates;
  try {
    coordinates = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(coordinates) || coordinates.length < 3 ||
        !coordinates.every((point) => Array.isArray(point) && point.length === 2 &&
          point.every((number) => typeof number === "number" && Number.isFinite(number)))) return null;
    coordinates = coordinates.map((point) => [...point]);
    if (pointKey(coordinates[0]) === pointKey(coordinates[coordinates.length - 1])) coordinates.pop();
    if (coordinates.length < 3) return null;
    return { coordinates, bounds: boundsOf(coordinates), triangles: null };
  } catch (_) {
    return null; // Legacy point markers or unreadable coordinates have no polygon interior.
  }
}

function triangulate(geometry) {
  if (geometry.triangles) return geometry.triangles;
  const points = geometry.coordinates.map((point) => [...point]);
  // Remove straight-edge points so they cannot prevent an otherwise valid ear.
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      if (onSegment(points[(i + points.length - 1) % points.length],
        points[(i + 1) % points.length], points[i])) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (signedTwiceArea(points) < 0) points.reverse();
  const triangles = [];
  while (points.length > 3) {
    let foundEar = false;
    for (let i = 0; i < points.length; i++) {
      const before = (i + points.length - 1) % points.length;
      const after = (i + 1) % points.length;
      const [a, b, c] = [points[before], points[i], points[after]];
      if (cross(a, b, c) <= GEOMETRY_EPSILON) continue;
      const containsPoint = points.some((point, index) => index !== before && index !== i && index !== after &&
        cross(a, b, point) >= -GEOMETRY_EPSILON && cross(b, c, point) >= -GEOMETRY_EPSILON &&
        cross(c, a, point) >= -GEOMETRY_EPSILON);
      if (containsPoint) continue;
      const triangle = [a, b, c];
      triangles.push({ points: triangle, bounds: boundsOf(triangle) });
      points.splice(i, 1);
      foundEar = true;
      break;
    }
    if (!foundEar) return null;
  }
  if (points.length === 3 && cross(...points) > GEOMETRY_EPSILON) {
    triangles.push({ points, bounds: boundsOf(points) });
  }
  if (!triangles.length) return null;
  geometry.triangles = triangles;
  return triangles;
}

function triangleIntersectionArea(subject, clip) {
  let output = subject;
  // Sutherland–Hodgman clipping is exact for the convex ear triangles.
  for (let i = 0; i < 3 && output.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % 3];
    const input = output;
    output = [];
    let previous = input[input.length - 1];
    let previousDistance = cross(a, b, previous);
    for (const current of input) {
      const currentDistance = cross(a, b, current);
      const previousInside = previousDistance >= 0;
      const currentInside = currentDistance >= 0;
      if (previousInside !== currentInside) {
        const fraction = previousDistance / (previousDistance - currentDistance);
        output.push([
          previous[0] + fraction * (current[0] - previous[0]),
          previous[1] + fraction * (current[1] - previous[1]),
        ]);
      }
      if (currentInside) output.push(current);
      previous = current;
      previousDistance = currentDistance;
    }
  }
  return output.length < 3 ? 0 : Math.abs(signedTwiceArea(output)) / 2;
}

function hasInteriorOverlap(first, second) {
  if (!first || !second || !boundsOverlap(first.bounds, second.bounds)) return false;
  // A local equirectangular scale is sufficient for subdivision-sized polygons.
  const latitude = (Math.max(first.bounds[0], second.bounds[0]) +
    Math.min(first.bounds[2], second.bounds[2])) / 2;
  const squareMetresPerDegree = METRES_PER_DEGREE ** 2 * Math.max(1e-6, Math.cos(latitude * Math.PI / 180));
  const threshold = OVERLAP_TOLERANCE_SQM / squareMetresPerDegree;
  const boundingArea = (Math.min(first.bounds[2], second.bounds[2]) - Math.max(first.bounds[0], second.bounds[0])) *
    (Math.min(first.bounds[3], second.bounds[3]) - Math.max(first.bounds[1], second.bounds[1]));
  if (boundingArea <= threshold) return false;
  const firstTriangles = triangulate(first);
  const secondTriangles = triangulate(second);
  if (!firstTriangles || !secondTriangles) {
    // Fail closed for a nearby malformed legacy polygon rather than silently
    // importing over a boundary whose occupied area cannot be checked.
    throw new LotImportError("A nearby lot boundary could not be checked for overlaps. Review its geometry before importing.", 409);
  }
  let area = 0;
  for (const a of firstTriangles) {
    for (const b of secondTriangles) {
      if (!boundsOverlap(a.bounds, b.bounds)) continue;
      area += triangleIntersectionArea(a.points, b.points);
      if (area > threshold) return true;
    }
  }
  return false;
}

function assertNoOverlappingLots(lots, existingLots = null) {
  const selected = lots.map((lot) => ({ lot, geometry: prepareGeometry(lot.coordinates) }));
  const comparison = existingLots
    ? existingLots.map((lot) => ({ lot, geometry: prepareGeometry(lot.coordinates) }))
    : selected;
  for (let i = 0; i < selected.length; i++) {
    for (let j = existingLots ? 0 : i + 1; j < comparison.length; j++) {
      if (!hasInteriorOverlap(selected[i].geometry, comparison[j].geometry)) continue;
      const a = selected[i].lot.lot_number;
      const b = comparison[j].lot.lot_number || `#${comparison[j].lot.lot_id}`;
      throw new LotImportError(
        `${a} overlaps ${existingLots ? "existing lot" : "selected lot"} ${b}. Correct or exclude the boundary before importing. No lots were imported.`,
        existingLots ? 409 : 400
      );
    }
  }
}

function validateImport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new LotImportError("An import request is required.");
  }
  const propertyId = (typeof body.property_id === "number" ||
    (typeof body.property_id === "string" && /^\d+$/.test(body.property_id)))
    ? Number(body.property_id) : NaN;
  if (!Number.isSafeInteger(propertyId) || propertyId < 1 || propertyId > 2147483647) {
    throw new LotImportError("A valid property ID is required.");
  }
  if (!Array.isArray(body.lots) || body.lots.length < 1 || body.lots.length > MAX_IMPORT_LOTS) {
    throw new LotImportError(`Select between 1 and ${MAX_IMPORT_LOTS} lots to import.`);
  }
  if (body.sourceName != null && (typeof body.sourceName !== "string" || body.sourceName.length > 255)) {
    throw new LotImportError("Source filename must be no longer than 255 characters.");
  }
  const names = new Set();
  const polygons = new Set();
  const lots = body.lots.map((lot, index) => {
    const label = `Lot ${index + 1}`;
    if (!lot || typeof lot.lot_number !== "string" || !lot.lot_number.trim() ||
        [...lot.lot_number.trim()].length > MAX_LOT_NUMBER_LENGTH || /[\u0000-\u001f\u007f]/.test(lot.lot_number)) {
      throw new LotImportError(`${label}: a unique block/lot identifier of 1–${MAX_LOT_NUMBER_LENGTH} characters is required.`);
    }
    const lotNumber = lot.lot_number.trim().replace(/\s+/g, " ");
    const name = normalizeLotNumber(lotNumber);
    if (names.has(name)) throw new LotImportError(`Duplicate lot identifier: ${lotNumber}. Include the block number where needed.`);
    names.add(name);
    if (typeof lot.area_sqm !== "number" || !Number.isFinite(lot.area_sqm) ||
        lot.area_sqm < 0.01 || lot.area_sqm > MAX_AREA_SQM) {
      throw new LotImportError(`${lotNumber}: area must be between 0.01 and ${MAX_AREA_SQM} square metres.`);
    }
    const coordinates = validatePolygon(lot.coordinates, lotNumber);
    const key = polygonKey(coordinates);
    if (polygons.has(key)) throw new LotImportError(`${lotNumber}: another selected lot has the same boundary.`);
    polygons.add(key);
    return {
      lot_number: lotNumber,
      area_sqm: Math.round((lot.area_sqm + Number.EPSILON) * 100) / 100,
      coordinates,
    };
  });
  assertNoOverlappingLots(lots);
  return { property_id: propertyId, sourceName: body.sourceName?.trim() || null, lots };
}

function assertNoExistingDuplicates(lots, existingLots) {
  const names = new Set(existingLots.map((lot) => normalizeLotNumber(lot.lot_number)));
  const polygons = new Set(existingLots.map((lot) => polygonKey(lot.coordinates)).filter(Boolean));
  for (const lot of lots) {
    if (names.has(normalizeLotNumber(lot.lot_number))) {
      throw new LotImportError(`Lot ${lot.lot_number} already exists in this property. No lots were imported.`, 409);
    }
    if (polygons.has(polygonKey(lot.coordinates))) {
      throw new LotImportError(`The boundary for ${lot.lot_number} already exists in this property. No lots were imported.`, 409);
    }
  }
  assertNoOverlappingLots(lots, existingLots);
}

module.exports = {
  MAX_IMPORT_LOTS, MAX_POLYGON_VERTICES, MAX_LOT_NUMBER_LENGTH, OVERLAP_TOLERANCE_SQM,
  LotImportError, validateImport, validatePolygon, polygonKey, assertNoExistingDuplicates, assertNoOverlappingLots,
};
