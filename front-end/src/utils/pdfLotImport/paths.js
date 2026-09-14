export const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

export function transformPoint(matrix, point) {
  return [matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
    matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]];
}

function multiply(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

// Work in displayed page coordinates, including the PDF's own page rotation.
export async function extractSegments(operatorList, OPS, viewport) {
  const segments = [];
  const stack = [];
  let matrix = viewport.transform;
  let paths = [];
  let current = null;
  let dashed = false;
  let clipBounds = [0, 0, viewport.width, viewport.height];
  let pendingClip = null;
  let strokeVisible = true;
  let pathOperations = 0;
  let pointCount = 0;
  const rectangularBounds = (clipPaths) => {
    if (!clipPaths?.length) return clipBounds;
    if (clipPaths.length !== 1 || clipPaths[0].length < 4 || clipPaths[0].length > 5) {
      throw new Error("This PDF uses complex clipping. Automatic lot detection needs a vector plan with a rectangular page crop.");
    }
    const polygon = clipPaths[0];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i]; const b = polygon[(i + 1) % polygon.length];
      if (Math.abs(a[0] - b[0]) > 0.001 && Math.abs(a[1] - b[1]) > 0.001) {
        throw new Error("This PDF uses rotated clipping. Export a vector plan with a rectangular page crop for automatic detection.");
      }
    }
    return [Math.max(clipBounds[0], Math.min(...polygon.map((p) => p[0]))),
      Math.max(clipBounds[1], Math.min(...polygon.map((p) => p[1]))),
      Math.min(clipBounds[2], Math.max(...polygon.map((p) => p[0]))),
      Math.min(clipBounds[3], Math.max(...polygon.map((p) => p[1])))];
  };
  const applyClip = () => { if (pendingClip) { clipBounds = pendingClip; pendingClip = null; } };
  const inClip = (point) => point[0] >= clipBounds[0] - 0.001 && point[0] <= clipBounds[2] + 0.001 &&
    point[1] >= clipBounds[1] - 0.001 && point[1] <= clipBounds[3] + 0.001;
  let nextPathId = 0;
  const addPoint = (point) => {
    pointCount += 1;
    if (pointCount > 150000 || !point?.every((value) => Number.isFinite(value) && Math.abs(value) < 1000000)) {
      throw new Error("The PDF drawing is too complex or has invalid coordinates. Use a simpler site-plan page.");
    }
    if (!current) { current = []; paths.push(current); }
    current.push(point);
  };
  const close = () => {
    if (current?.length > 1) current.push(current[0]);
  };
  const curve = (p1, p2, p3) => {
    const p0 = current?.[current.length - 1];
    if (!p0) return;
    current.curved = true;
    const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) +
      Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    const steps = Math.max(2, Math.min(64, Math.ceil(length / 2)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const s = 1 - t;
      addPoint([s ** 3 * p0[0] + 3 * s ** 2 * t * p1[0] + 3 * s * t ** 2 * p2[0] + t ** 3 * p3[0],
        s ** 3 * p0[1] + 3 * s ** 2 * t * p1[1] + 3 * s * t ** 2 * p2[1] + t ** 3 * p3[1]]);
    }
  };
  if (operatorList.fnArray.length > 200000) throw new Error("This PDF page is too complex to detect safely. Export a page containing only the subdivision plan.");
  for (let i = 0; i < operatorList.fnArray.length; i += 1) {
    if (i % 1000 === 0) await yieldToBrowser();
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];
    if (fn === OPS.save) stack.push({ matrix, dashed, clipBounds, strokeVisible });
    else if (fn === OPS.restore && stack.length) ({ matrix, dashed, clipBounds, strokeVisible } = stack.pop());
    else if (fn === OPS.transform) matrix = multiply(matrix, args);
    else if (fn === OPS.setDash) dashed = Boolean(args[0]?.length);
    else if (fn === OPS.setGState) {
      for (const [name, value] of args[0]) {
        if (name === "CA") strokeVisible = value > 0;
        if (name === "D") dashed = Boolean(value[0]?.length);
      }
    } else if (fn === OPS.clip || fn === OPS.eoClip) pendingClip = rectangularBounds(paths);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ matrix, dashed, clipBounds, strokeVisible });
      if (args[0]) matrix = multiply(matrix, args[0]);
      if (args[1]) {
        const [x1, y1, x2, y2] = args[1];
        const formMatrix = matrix;
        clipBounds = rectangularBounds([[[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map((p) => transformPoint(formMatrix, p))]);
      }
    } else if (fn === OPS.paintFormXObjectEnd && stack.length) ({ matrix, dashed, clipBounds, strokeVisible } = stack.pop());
    else if (fn === OPS.beginGroup) throw new Error("This PDF uses grouped transparency that is not supported by lot detection. Use a flattened vector PDF.");
    else if (fn === OPS.constructPath) {
      const [operations, coordinates] = args;
      pathOperations += operations.length;
      if (pathOperations > 150000) throw new Error("This PDF has too many drawing paths. Use a simpler vector site-plan PDF.");
      let offset = 0;
      const pathMatrix = matrix;
      const point = () => transformPoint(pathMatrix, [coordinates[offset++], coordinates[offset++]]);
      for (let operationIndex = 0; operationIndex < operations.length; operationIndex += 1) {
        if (operationIndex > 0 && operationIndex % 1000 === 0) await yieldToBrowser();
        const operation = operations[operationIndex];
        if (operation === OPS.moveTo) { current = []; paths.push(current); addPoint(point()); }
        else if (operation === OPS.lineTo) addPoint(point());
        else if (operation === OPS.curveTo) curve(point(), point(), point());
        else if (operation === OPS.curveTo2) curve(current?.[current.length - 1], point(), point());
        else if (operation === OPS.curveTo3) { const control = point(); const end = point(); curve(control, end, end); }
        else if (operation === OPS.closePath) close();
        else if (operation === OPS.rectangle) {
          const x = coordinates[offset++]; const y = coordinates[offset++];
          const width = coordinates[offset++]; const height = coordinates[offset++];
          current = []; paths.push(current);
          for (const p of [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]]) addPoint(transformPoint(matrix, p));
        }
      }
    } else if ([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn)) {
      if ([OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn)) close();
      if (!dashed && strokeVisible) {
        for (const path of paths) {
          const pathId = nextPathId++;
          for (let j = 1; j < path.length; j += 1) {
            const a = path[j - 1]; const b = path[j];
            // Keep complete visible segments only. Never invent a boundary along a crop.
            if (inClip(a) && inClip(b) && Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.03) segments.push({ a, b, curved: Boolean(path.curved), pathId });
          }
        }
      }
      applyClip();
      paths = []; current = null;
      if (segments.length > 20000) throw new Error("Too many vector lines to detect safely. Use a simplified subdivision page.");
    } else if ([OPS.fill, OPS.eoFill, OPS.endPath].includes(fn)) {
      // Filled glyph outlines and clipping rectangles are not parcel boundaries.
      applyClip();
      paths = []; current = null;
    }
  }
  return segments;
}
