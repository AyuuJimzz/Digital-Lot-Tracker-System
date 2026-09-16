// Build a plan-shaped mask from the detected parcels, including reserved areas.
// Closing narrow gaps keeps internal roads; enclosed holes retain the site interior.
// This runs on a bounded grid so large PDF renders do not freeze the upload.
function distanceFrom(mask, width, height, value) {
  const distances = new Float32Array(mask.length);
  const diagonal = Math.SQRT2;
  for (let i = 0; i < mask.length; i += 1) distances[i] = mask[i] === value ? 0 : 100000;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    let d = distances[i];
    if (x) d = Math.min(d, distances[i - 1] + 1);
    if (y) {
      d = Math.min(d, distances[i - width] + 1);
      if (x) d = Math.min(d, distances[i - width - 1] + diagonal);
      if (x + 1 < width) d = Math.min(d, distances[i - width + 1] + diagonal);
    }
    distances[i] = d;
  }
  for (let y = height - 1; y >= 0; y -= 1) for (let x = width - 1; x >= 0; x -= 1) {
    const i = y * width + x;
    let d = distances[i];
    if (x + 1 < width) d = Math.min(d, distances[i + 1] + 1);
    if (y + 1 < height) {
      d = Math.min(d, distances[i + width] + 1);
      if (x) d = Math.min(d, distances[i + width - 1] + diagonal);
      if (x + 1 < width) d = Math.min(d, distances[i + width + 1] + diagonal);
    }
    distances[i] = d;
  }
  return distances;
}

function fillPolygon(mask, width, height, points) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const crossings = [], scanY = y + 0.5;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] > scanY) !== (b[1] > scanY)) crossings.push(a[0] + (scanY - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = Math.max(0, Math.floor(crossings[i]));
      const end = Math.min(width - 1, Math.ceil(crossings[i + 1]));
      for (let x = start; x <= end; x += 1) mask[y * width + x] = 1;
    }
  }
}

function fillHoles(mask, width, height) {
  const outside = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let head = 0, tail = 0;
  const visit = (i) => {
    if (!mask[i] && !outside[i]) { outside[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x += 1) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width, y = Math.floor(i / width);
    if (x) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (y) visit(i - width);
    if (y + 1 < height) visit(i + width);
  }
  for (let i = 0; i < mask.length; i += 1) if (!outside[i]) mask[i] = 1;
}

export function buildAutomaticPlanMask(detection, maxDimension = 1400) {
  const { candidates = [], pageWidth, pageHeight } = detection || {};
  if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) return null;
  const usable = candidates.filter((c) => c.points?.length >= 3 && c.points.length <= 200 &&
    c.points.every((p) => p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)));
  if (usable.length < 3) return null;
  const limit = Number.isFinite(maxDimension) ? Math.max(16, Math.min(1400, Math.floor(maxDimension))) : 1400;
  const scale = Math.min(2, limit / Math.max(pageWidth, pageHeight));
  const width = Math.min(limit, Math.ceil(pageWidth * scale)), height = Math.min(limit, Math.ceil(pageHeight * scale));
  const seeds = new Uint8Array(width * height);
  const shortSides = [];
  for (const candidate of usable) {
    const points = candidate.points.map(([x, y]) => [x * width, y * height]);
    fillPolygon(seeds, width, height, points);
    if (!candidate.nonSaleable) {
      // Area / longest side estimates parcel width without depending on rotation.
      let area = 0, longest = 0;
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i], b = points[(i + 1) % points.length];
        area += a[0] * b[1] - a[1] * b[0];
        longest = Math.max(longest, Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      if (longest > 0) shortSides.push(Math.abs(area) / 2 / longest);
    }
  }
  const seedCount = seeds.reduce((sum, value) => sum + value, 0);
  if (seedCount < width * height * 0.002) return null;
  shortSides.sort((a, b) => a - b);
  const medianWidth = shortSides[Math.floor(shortSides.length / 2)] || 12 * scale;
  const radius = Math.max(4 * scale, Math.min(20 * scale, medianWidth * 0.85));
  const margin = Math.max(2, 2 * scale);
  const outward = distanceFrom(seeds, width, height, 1);
  const joined = Uint8Array.from(outward, (distance) => distance <= radius ? 1 : 0);
  fillHoles(joined, width, height);
  const inward = distanceFrom(joined, width, height, 0);
  const mask = Uint8Array.from(inward, (distance, i) => distance > radius - margin || seeds[i] ? 1 : 0);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (mask[y * width + x]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1);
  }
  const cropBounds = { minX: minX / width * 100, minY: minY / height * 100,
    maxX: maxX / width * 100, maxY: maxY / height * 100,
    width: (maxX - minX) / width * 100, height: (maxY - minY) / height * 100 };
  return { mask, width, height, cropBounds, radius };
}

export function cropBlueprintCanvas(sourceCanvas, detection, createCanvas = () => document.createElement("canvas")) {
  const plan = buildAutomaticPlanMask(detection);
  if (!plan) return null;
  const { mask, width, height, cropBounds } = plan;
  const maskCanvas = createCanvas();
  maskCanvas.width = width; maskCanvas.height = height;
  const maskContext = maskCanvas.getContext("2d");
  const pixels = maskContext.createImageData(width, height);
  for (let i = 0; i < mask.length; i += 1) pixels.data[i * 4 + 3] = mask[i] ? 255 : 0;
  maskContext.putImageData(pixels, 0, 0);
  const canvas = createCanvas();
  canvas.width = Math.max(10, Math.round(sourceCanvas.width * cropBounds.width / 100));
  canvas.height = Math.max(10, Math.round(sourceCanvas.height * cropBounds.height / 100));
  const context = canvas.getContext("2d");
  const x = sourceCanvas.width * cropBounds.minX / 100, y = sourceCanvas.height * cropBounds.minY / 100;
  context.drawImage(sourceCanvas, -x, -y);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(maskCanvas, -x, -y, sourceCanvas.width, sourceCanvas.height);
  context.globalCompositeOperation = "source-over";
  return { imageUrl: canvas.toDataURL("image/png"), cropBounds };
}
