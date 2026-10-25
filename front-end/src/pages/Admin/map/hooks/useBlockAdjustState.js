import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config/api";
import { getAuthConfig } from "../utils/mapConstants";
import { showToast } from "../../../../components/GlobalToast";

const safeParseCoordinates = (coords) => {
  if (!coords) return [];
  if (Array.isArray(coords)) return coords;
  if (typeof coords === "string") {
    try {
      const parsed = JSON.parse(coords);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export function isMatchingBlockAnnotation(annotText, blockName) {
  if (!annotText || !blockName) return false;
  const cleanA = annotText.trim().toLowerCase();
  const cleanB = blockName.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const matchA = cleanA.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)/i);
  const matchB = cleanB.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)/i);
  if (matchA && matchB && matchA[1].toLowerCase() === matchB[1].toLowerCase()) {
    const isBlockA = /^\s*(?:blk|block|b)\.?\s*[0-9a-zA-Z-]+/i.test(cleanA);
    const isBlockB = /^\s*(?:blk|block|b)\.?\s*[0-9a-zA-Z-]+/i.test(cleanB);
    if (isBlockA && isBlockB) return true;
  }
  return false;
}

export function useBlockAdjustState({
  selectedProperty,
  mapData,
  handleLotUpdated,
  map,
  overlayRotation = 0,
  annotations = [],
  setAnnotations,
  persistAnnotations,
}) {
  const [isBlockAdjusting, setIsBlockAdjusting] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [scaleX, setScaleX] = useState(1.0); // Width scale factor
  const [scaleY, setScaleY] = useState(1.0); // Height / Length scale factor
  const [offset, setOffset] = useState({ lat: 0, lng: 0 });
  const [rotation, setRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Active side or corner currently being dragged
  const [activeHandle, setActiveHandle] = useState(null);

  // Listen for open event from AdminHeader
  useEffect(() => {
    const handleOpen = () => {
      setIsBlockAdjusting((prev) => {
        const next = !prev;
        if (next) {
          window.dispatchEvent(new CustomEvent("closeQuickAddLot"));
          window.dispatchEvent(new CustomEvent("closeBulkShift"));
          window.dispatchEvent(new CustomEvent("closeAnnotationPanel"));
        }
        return next;
      });
      setScaleX(1.0);
      setScaleY(1.0);
      setOffset({ lat: 0, lng: 0 });
      setRotation(0);
    };
    const handleClose = () => setIsBlockAdjusting(false);

    window.addEventListener("openBlockAdjustPanel", handleOpen);
    window.addEventListener("closeBlockAdjustPanel", handleClose);
    return () => {
      window.removeEventListener("openBlockAdjustPanel", handleOpen);
      window.removeEventListener("closeBlockAdjustPanel", handleClose);
    };
  }, []);

  // Filter lots belonging to active property
  const propertyLots = useMemo(() => {
    if (!mapData?.lots || !selectedProperty) return [];
    return mapData.lots.filter(
      (l) => Number(l.property_id) === Number(selectedProperty)
    );
  }, [mapData?.lots, selectedProperty]);

  // Extract all distinct blocks
  const availableBlocks = useMemo(() => {
    if (!propertyLots || propertyLots.length === 0) return [];
    const blockSet = new Set();

    propertyLots.forEach((lot) => {
      const str = String(lot.lot_number || "").trim();
      const match = str.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)/i);
      if (match) {
        blockSet.add(`Block ${match[1]}`);
      } else {
        blockSet.add("Other Lots");
      }
    });

    return Array.from(blockSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [propertyLots]);

  // Auto-select first available block if none selected
  useEffect(() => {
    if (isBlockAdjusting && !selectedBlock && availableBlocks.length > 0) {
      setSelectedBlock(availableBlocks[0]);
    }
  }, [isBlockAdjusting, selectedBlock, availableBlocks]);

  // Lots in currently selected block
  const selectedBlockLots = useMemo(() => {
    if (!selectedBlock || propertyLots.length === 0) return [];
    return propertyLots.filter((lot) => {
      const str = String(lot.lot_number || "").trim();
      const match = str.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)/i);
      const bName = match ? `Block ${match[1]}` : "Other Lots";
      return bName.toLowerCase() === selectedBlock.toLowerCase();
    });
  }, [selectedBlock, propertyLots]);

  // Centroid of the unscaled original block
  const blockCentroid = useMemo(() => {
    if (!selectedBlockLots || selectedBlockLots.length === 0) return null;
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    selectedBlockLots.forEach((lot) => {
      const coords = safeParseCoordinates(lot.coordinates);
      if (Array.isArray(coords)) {
        coords.forEach(([lat, lng]) => {
          sumLat += lat;
          sumLng += lng;
          count++;
        });
      }
    });

    if (count === 0) return null;
    return [sumLat / count, sumLng / count];
  }, [selectedBlockLots]);

  // ── 1. Base Boundary Quad Derivation (Intrinsic Geometric Invariant) ────
  // Discovers the 4 true physical boundary lines of the unshifted block,
  // strips diagonal corner chamfers, and computes base bilinear coefficients.
  // This is memoized purely on the block lots and centroid.
  const baseBoundaryQuad = useMemo(() => {
    if (!selectedBlockLots || selectedBlockLots.length === 0 || !blockCentroid) {
      return null;
    }
    const [cLat, cLng] = blockCentroid;
    const cosLat = Math.cos((cLat * Math.PI) / 180);

    const toXY = (pt) => ({ x: (pt[1] - cLng) * cosLat, y: pt[0] - cLat });
    const toLatLon = (xy) => [cLat + xy.y, cLng + (cosLat ? xy.x / cosLat : xy.x)];

    // Collect all valid perimeter edges
    const edgeList = [];
    selectedBlockLots.forEach((lot) => {
      const coords = safeParseCoordinates(lot.coordinates);
      if (!Array.isArray(coords) || coords.length < 3) return;

      const n = coords.length;
      for (let i = 0; i < n; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % n];
        const dy = p2[0] - p1[0];
        const dx = (p2[1] - p1[1]) * cosLat;
        const len = Math.hypot(dx, dy);
        if (len > 0.0000005) {
          let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          deg = ((deg % 180) + 180) % 180;
          if (deg >= 90) deg -= 180;
          edgeList.push({ p1, p2, deg, len, mid: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2] });
        }
      }
    });

    if (edgeList.length === 0) return null;

    // Discover dominant longitudinal direction
    let bestLongDeg = 54.0;
    let maxLongWeight = 0;
    for (let a = -90; a < 90; a += 1.0) {
      let w = 0;
      for (let i = 0; i < edgeList.length; i++) {
        let diff = Math.abs(edgeList[i].deg - a);
        if (diff > 90) diff = 180 - diff;
        if (diff < 15) w += edgeList[i].len * Math.cos((diff * Math.PI) / 30);
      }
      if (w > maxLongWeight) {
        maxLongWeight = w;
        bestLongDeg = a;
      }
    }

    // Discover transverse divider direction (~82-90 deg offset)
    let bestTransDeg = bestLongDeg - 90;
    if (bestTransDeg < -90) bestTransDeg += 180;
    let maxTransWeight = 0;
    for (let a = -90; a < 90; a += 1.0) {
      let diff1 = Math.abs(a - bestLongDeg);
      if (diff1 > 90) diff1 = 180 - diff1;
      if (diff1 < 40) continue;
      let w = 0;
      for (let i = 0; i < edgeList.length; i++) {
        let diff = Math.abs(edgeList[i].deg - a);
        if (diff > 90) diff = 180 - diff;
        if (diff < 15) w += edgeList[i].len * Math.cos((diff * Math.PI) / 30);
      }
      if (w > maxTransWeight) {
        maxTransWeight = w;
        bestTransDeg = a;
      }
    }

    // Refine dominant angles via circular weighted average of matching edges
    const getRefinedAngle = (targetDeg) => {
      let sumSin = 0;
      let sumCos = 0;
      edgeList.forEach((e) => {
        let diff = Math.abs(e.deg - targetDeg);
        if (diff > 90) diff = 180 - diff;
        if (diff <= 12) {
          const r = (e.deg * 2 * Math.PI) / 180;
          sumSin += e.len * Math.sin(r);
          sumCos += e.len * Math.cos(r);
        }
      });
      return (Math.atan2(sumSin, sumCos) * 180 / Math.PI) / 2;
    };

    const angle1 = getRefinedAngle(bestLongDeg);
    const angle2 = getRefinedAngle(bestTransDeg);

    const r1 = (angle1 * Math.PI) / 180;
    const r2 = (angle2 * Math.PI) / 180;
    let e1 = { x: Math.cos(r1), y: Math.sin(r1) };
    let e2 = { x: Math.cos(r2), y: Math.sin(r2) };
    let det = e1.x * e2.y - e1.y * e2.x;

    if (Math.abs(det) < 0.1) {
      e2 = { x: -e1.y, y: e1.x };
      det = e1.x * e2.y - e1.y * e2.x;
    }

    // Project all lot vertices onto the 2D affine basis (e1, e2) to guarantee
    // the bounding parallelogram tightly encloses 100% of all vertices with zero clipping.
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    selectedBlockLots.forEach((lot) => {
      const coords = safeParseCoordinates(lot.coordinates);
      if (!Array.isArray(coords)) return;
      coords.forEach(([lat, lng]) => {
        const xy = toXY([lat, lng]);
        const u = (xy.x * e2.y - xy.y * e2.x) / det;
        const v = (-xy.x * e1.y + xy.y * e1.x) / det;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      });
    });

    const toPt = (u, v) => toLatLon({ x: u * e1.x + v * e2.x, y: u * e1.y + v * e2.y });

    const c00 = toPt(minU, minV);
    const c10 = toPt(maxU, minV);
    const c11 = toPt(maxU, maxV);
    const c01 = toPt(minU, maxV);
    const allCorners = [c00, c10, c11, c01];

    // Partition and assign NW, NE, SE, SW based on geographic y (North) and x (East)
    const sortedByY = [...allCorners].sort((a, b) => toXY(b).y - toXY(a).y);
    const topTwo = [sortedByY[0], sortedByY[1]].sort((a, b) => toXY(a).x - toXY(b).x);
    const bottomTwo = [sortedByY[2], sortedByY[3]].sort((a, b) => toXY(a).x - toXY(b).x);

    const nw = topTwo[0];
    const ne = topTwo[1];
    const se = bottomTwo[1];
    const sw = bottomTwo[0];

    const angleOf = (pA, pB) => {
      let deg = (Math.atan2(pB[0] - pA[0], (pB[1] - pA[1]) * cosLat) * 180) / Math.PI;
      deg = ((deg % 180) + 180) % 180;
      if (deg >= 90) deg -= 180;
      return deg;
    };

    const sideAngles = {
      top: angleOf(nw, ne),
      bottom: angleOf(sw, se),
      left: angleOf(sw, nw),
      right: angleOf(se, ne),
    };

    // Base Bilinear coefficients:
    const [q0, q1, q2, q3] = [nw, ne, se, sw].map((p) => toXY(p));
    const a0 = (q0.x + q1.x + q2.x + q3.x) / 4;
    const a1 = (-q0.x + q1.x + q2.x - q3.x) / 4;
    const a2 = (q0.x + q1.x - q2.x - q3.x) / 4;
    const a3 = (-q0.x + q1.x - q2.x + q3.x) / 4;

    const b0 = (q0.y + q1.y + q2.y + q3.y) / 4;
    const b1 = (-q0.y + q1.y + q2.y - q3.y) / 4;
    const b2 = (q0.y + q1.y - q2.y - q3.y) / 4;
    const b3 = (-q0.y + q1.y - q2.y + q3.y) / 4;

    // Base inverse map: solves (s, t) for unshifted GPS coordinate
    const baseInverse = (lat, lng) => {
      const xy = toXY([lat, lng]);
      let s = 0, t = 0;
      for (let iter = 0; iter < 8; iter++) {
        const F = a0 + a1 * s + a2 * t + a3 * s * t - xy.x;
        const G = b0 + b1 * s + b2 * t + b3 * s * t - xy.y;
        if (Math.abs(F) < 1e-12 && Math.abs(G) < 1e-12) break;
        const Fs = a1 + a3 * t;
        const Ft = a2 + a3 * s;
        const Gs = b1 + b3 * t;
        const Gt = b2 + b3 * s;
        const det = Fs * Gt - Ft * Gs;
        if (Math.abs(det) < 1e-12) break;
        s -= (F * Gt - G * Ft) / det;
        t -= (-F * Gs + G * Fs) / det;
      }
      return { s, t };
    };

    return {
      cLat,
      cLng,
      cosLat,
      a0, a1, a2, a3,
      b0, b1, b2, b3,
      sideAngles,
      totalAngle: sideAngles.left,
      baseInverse,
    };
  }, [selectedBlockLots, blockCentroid]);

  // ── 2. Precomputed UV Map (Calculated ONCE per block) ───────────
  // Maps each vertex in the block to its fixed normalized coordinate (s_0, t_0).
  // These invariants NEVER mutate during dragging, nudging, or scaling.
  const originalLotUVMap = useMemo(() => {
    if (!selectedBlockLots || !baseBoundaryQuad) return new Map();
    const mapResult = new Map();
    selectedBlockLots.forEach((lot) => {
      const coords = safeParseCoordinates(lot.coordinates);
      if (!Array.isArray(coords) || coords.length === 0) return;
      const targetLotId = Number(lot.lot_id ?? lot.id);
      const uvs = coords.map(([lat, lng]) => baseBoundaryQuad.baseInverse(lat, lng));
      mapResult.set(targetLotId, uvs);
    });
    return mapResult;
  }, [selectedBlockLots, baseBoundaryQuad]);

  // ── 2b. Precomputed UV Map for matching block text annotations ────
  const originalAnnotationUVMap = useMemo(() => {
    if (!annotations || annotations.length === 0 || !baseBoundaryQuad || !selectedBlock) {
      return new Map();
    }
    const mapResult = new Map();
    annotations.forEach((annot) => {
      if (!annot || annot.deleted) return;
      if (isMatchingBlockAnnotation(annot.text, selectedBlock)) {
        const lat = Number(annot.lat);
        const lng = Number(annot.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const uv = baseBoundaryQuad.baseInverse(lat, lng);
          mapResult.set(String(annot.id), {
            uv,
            initialRotation: Number(annot.rotation) || 0,
          });
        }
      }
    });
    return mapResult;
  }, [annotations, baseBoundaryQuad, selectedBlock]);

  // ── 3. Active Quad Transformer (With Offset & Rotation) ────────
  // Provides forward mapping and mouse inverse mapping incorporating current
  // user offset and rotation.
  const activeQuad = useMemo(() => {
    if (!baseBoundaryQuad) return null;
    const { cLat, cLng, cosLat, a0, a1, a2, a3, b0, b1, b2, b3, sideAngles, totalAngle } =
      baseBoundaryQuad;

    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // Forward map: (s, t) -> GPS [lat, lng]
    const forward = (s, t) => {
      const x = a0 + a1 * s + a2 * t + a3 * s * t;
      const y = b0 + b1 * s + b2 * t + b3 * s * t;

      let rx = x, ry = y;
      if (rotation !== 0) {
        rx = x * cosR - y * sinR;
        ry = x * sinR + y * cosR;
      }

      const lat = cLat + offset.lat + ry;
      const lng = cLng + offset.lng + (cosLat ? rx / cosLat : rx);
      return [lat, lng];
    };

    // Inverse map: GPS [lat, lng] -> (s, t) for mouse interactions
    const inverse = (lat, lng) => {
      const dx = (lng - (cLng + offset.lng)) * cosLat;
      const dy = lat - (cLat + offset.lat);

      let ux = dx, uy = dy;
      if (rotation !== 0) {
        ux = dx * cosR + dy * sinR;
        uy = -dx * sinR + dy * cosR;
      }

      let s = 0, t = 0;
      for (let iter = 0; iter < 8; iter++) {
        const F = a0 + a1 * s + a2 * t + a3 * s * t - ux;
        const G = b0 + b1 * s + b2 * t + b3 * s * t - uy;
        if (Math.abs(F) < 1e-11 && Math.abs(G) < 1e-11) break;
        const Fs = a1 + a3 * t;
        const Ft = a2 + a3 * s;
        const Gs = b1 + b3 * t;
        const Gt = b2 + b3 * s;
        const det = Fs * Gt - Ft * Gs;
        if (Math.abs(det) < 1e-11) break;
        s -= (F * Gt - G * Ft) / det;
        t -= (-F * Gs + G * Fs) / det;
      }
      return { s, t };
    };

    return {
      forward,
      inverse,
      sideAngles: {
        top: sideAngles.top + rotation,
        bottom: sideAngles.bottom + rotation,
        left: sideAngles.left + rotation,
        right: sideAngles.right + rotation,
      },
      totalAngle: totalAngle + rotation,
    };
  }, [baseBoundaryQuad, offset, rotation]);

  // ── 4. Real-Time Transformed Lots Map ──────────────────────────
  // Moves and scales all lot polygons strictly synchronous with the controlling box!
  const transformedLotsMap = useMemo(() => {
    if (!selectedBlockLots || !activeQuad || !originalLotUVMap) return new Map();
    const mapResult = new Map();

    selectedBlockLots.forEach((lot) => {
      const targetLotId = Number(lot.lot_id ?? lot.id);
      const uvs = originalLotUVMap.get(targetLotId);
      if (!uvs) return;

      const newCoords = uvs.map(({ s, t }) =>
        activeQuad.forward(s * scaleX, t * scaleY)
      );

      const origArea = Number(lot.area_sqm) || 100;
      const newArea = Math.round(origArea * scaleX * scaleY * 10) / 10;

      mapResult.set(targetLotId, {
        coordinates: newCoords,
        area_sqm: newArea,
      });
    });

    return mapResult;
  }, [selectedBlockLots, activeQuad, originalLotUVMap, scaleX, scaleY]);

  // ── 4b. Real-Time Transformed Annotations Map ──────────────────
  const transformedAnnotationsMap = useMemo(() => {
    if (!activeQuad || originalAnnotationUVMap.size === 0) return new Map();
    const mapResult = new Map();

    originalAnnotationUVMap.forEach(({ uv, initialRotation }, annotId) => {
      const [newLat, newLng] = activeQuad.forward(uv.s * scaleX, uv.t * scaleY);
      mapResult.set(String(annotId), {
        lat: newLat,
        lng: newLng,
        rotation: (initialRotation + rotation) % 360,
      });
    });

    return mapResult;
  }, [activeQuad, originalAnnotationUVMap, scaleX, scaleY, rotation]);

  // ── 5. Controlling Bounding Box Geometry ────────────────────────
  // The dashed box and handles strictly match the active quad transformation
  const boxGeometry = useMemo(() => {
    if (!activeQuad) return null;
    const { forward, sideAngles, totalAngle } = activeQuad;

    // Center of active quad (follows offset and rotation seamlessly)
    const center = forward(0, 0);

    // 4 Corners: NW -> NE -> SE -> SW
    const nw = forward(-scaleX, scaleY);
    const ne = forward(scaleX, scaleY);
    const se = forward(scaleX, -scaleY);
    const sw = forward(-scaleX, -scaleY);

    // 4 Side Handles (exact midpoints of the quadrilateral edges)
    const topSide = forward(0, scaleY);     // North side (pantay sa top boundary)
    const bottomSide = forward(0, -scaleY); // South side (pantay sa Road Lot 1)
    const leftSide = forward(-scaleX, 0);   // West side (pantay sa Road Lot 2)
    const rightSide = forward(scaleX, 0);   // East side (pantay sa Road Lot 3)

    return {
      polygon: [nw, ne, se, sw],
      center,
      corners: { nw, ne, se, sw },
      sides: {
        right: rightSide,
        left: leftSide,
        top: topSide,
        bottom: bottomSide,
      },
      sideAngles,
      totalAngle,
    };
  }, [activeQuad, scaleX, scaleY]);

  // ── 6. Drag Gesture Engine for Side & Corner Handles ────────────
  const dragHandleRef = useRef(null);

  const handleStartHandleDrag = useCallback(
    (handleKey, e) => {
      if (!map || !activeQuad) return;
      if (e?.originalEvent) {
        e.originalEvent.stopPropagation();
      }
      map.dragging.disable();
      setActiveHandle(handleKey);

      dragHandleRef.current = {
        handleKey,
        initScaleX: scaleX,
        initScaleY: scaleY,
      };

      let rafId = null;
      const onMouseMove = (moveEvent) => {
        if (!dragHandleRef.current || !activeQuad) return;
        let latLng = moveEvent.latlng;
        if (!latLng && typeof moveEvent.clientX === "number") {
          try {
            latLng = map.mouseEventToLatLng(moveEvent);
          } catch (_) {
            return;
          }
        }
        if (!latLng) return;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const { s, t } = activeQuad.inverse(latLng.lat, latLng.lng);

          if (handleKey === "right") {
            // Pulling right side expands width
            const nextScaleX = Math.max(0.3, Math.min(3.0, s));
            setScaleX(Math.round(nextScaleX * 100) / 100);
          } else if (handleKey === "left") {
            // Pulling left side expands width
            const nextScaleX = Math.max(0.3, Math.min(3.0, -s));
            setScaleX(Math.round(nextScaleX * 100) / 100);
          } else if (handleKey === "top") {
            // Pulling top side expands length/height
            const nextScaleY = Math.max(0.3, Math.min(3.0, t));
            setScaleY(Math.round(nextScaleY * 100) / 100);
          } else if (handleKey === "bottom") {
            // Pulling bottom side expands length/height
            const nextScaleY = Math.max(0.3, Math.min(3.0, -t));
            setScaleY(Math.round(nextScaleY * 100) / 100);
          } else if (
            handleKey === "ne" ||
            handleKey === "se" ||
            handleKey === "nw" ||
            handleKey === "sw"
          ) {
            // Corner handle: proportional uniform scale
            const factorS = Math.abs(s);
            const factorT = Math.abs(t);
            const avg = Math.max(0.3, Math.min(3.0, (factorS + factorT) / 2));
            const rounded = Math.round(avg * 100) / 100;
            setScaleX(rounded);
            setScaleY(rounded);
          }
        });
      };

      const onMouseUp = () => {
        dragHandleRef.current = null;
        setActiveHandle(null);
        if (rafId) cancelAnimationFrame(rafId);
        if (map) map.dragging.enable();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("mouseup", onMouseUp);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    },
    [map, activeQuad, scaleX, scaleY]
  );

  // Direct Mouse Dragging of the entire block on map
  const isDraggingBlockRef = useRef(false);
  const startDragPointRef = useRef(null);
  const initOffsetRef = useRef({ lat: 0, lng: 0 });

  const handleStartBlockDrag = useCallback(
    (e) => {
      if (!map) return;
      if (e?.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
      }
      map.dragging.disable();
      isDraggingBlockRef.current = true;
      startDragPointRef.current = e.latlng;
      initOffsetRef.current = { ...offset };

      let rafId = null;
      const onMove = (moveEvent) => {
        if (!isDraggingBlockRef.current || !startDragPointRef.current) return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const dLat = moveEvent.latlng.lat - startDragPointRef.current.lat;
          const dLng = moveEvent.latlng.lng - startDragPointRef.current.lng;
          setOffset({
            lat: initOffsetRef.current.lat + dLat,
            lng: initOffsetRef.current.lng + dLng,
          });
        });
      };

      const onUp = () => {
        isDraggingBlockRef.current = false;
        if (rafId) cancelAnimationFrame(rafId);
        map.dragging.enable();
        map.off("mousemove", onMove);
        map.off("mouseup", onUp);
        window.removeEventListener("mouseup", onUp);
      };

      map.on("mousemove", onMove);
      map.on("mouseup", onUp);
      window.addEventListener("mouseup", onUp);
    },
    [map, offset]
  );

  // Micro Nudge Controls (Aligned with block & road geometry)
  const handleNudge = useCallback(
    (dirOrDLat, dLng = 0, stepMeters = 0.00003) => {
      let stepLat = 0;
      let stepLng = 0;

      if (typeof dirOrDLat === "string" && activeQuad && blockCentroid) {
        const [cLat] = blockCentroid;
        const cosLat = Math.cos((cLat * Math.PI) / 180) || 1;
        const radLong = (activeQuad.sideAngles.left * Math.PI) / 180;
        const radTrans = (activeQuad.sideAngles.bottom * Math.PI) / 180;

        if (dirOrDLat === "up") {
          // Slide straight forward along the block & road length
          stepLat = stepMeters * Math.sin(radLong);
          stepLng = (stepMeters * Math.cos(radLong)) / cosLat;
        } else if (dirOrDLat === "down") {
          // Slide straight backward along the block & road length
          stepLat = -stepMeters * Math.sin(radLong);
          stepLng = (-stepMeters * Math.cos(radLong)) / cosLat;
        } else if (dirOrDLat === "right") {
          // Slide straight across the block to the right
          stepLat = stepMeters * Math.sin(radTrans);
          stepLng = (stepMeters * Math.cos(radTrans)) / cosLat;
        } else if (dirOrDLat === "left") {
          // Slide straight across the block to the left
          stepLat = -stepMeters * Math.sin(radTrans);
          stepLng = (-stepMeters * Math.cos(radTrans)) / cosLat;
        }
      } else if (typeof dirOrDLat === "number") {
        stepLat = dirOrDLat;
        stepLng = dLng;
      }

      setOffset((prev) => ({
        lat: prev.lat + stepLat,
        lng: prev.lng + stepLng,
      }));
    },
    [activeQuad, blockCentroid]
  );

  // Scale Controls from Panel (Uniform)
  const handleScaleChange = useCallback((newFactor) => {
    const clamped = Math.max(0.3, Math.min(3.0, Math.round(newFactor * 100) / 100));
    setScaleX(clamped);
    setScaleY(clamped);
  }, []);

  const handleScaleDelta = useCallback((delta) => {
    setScaleX((prev) => Math.max(0.3, Math.min(3.0, Math.round((prev + delta) * 100) / 100)));
    setScaleY((prev) => Math.max(0.3, Math.min(3.0, Math.round((prev + delta) * 100) / 100)));
  }, []);

  // Rotation Controls
  const handleRotateDelta = useCallback((deltaDegrees) => {
    setRotation((prev) => {
      const next = (prev + deltaDegrees) % 360;
      return Math.round(next * 10) / 10;
    });
  }, []);

  // Reset to original
  const handleReset = useCallback(() => {
    setScaleX(1.0);
    setScaleY(1.0);
    setOffset({ lat: 0, lng: 0 });
    setRotation(0);
  }, []);

  // Save Block Changes to database
  const handleSaveBlock = useCallback(async () => {
    if (transformedLotsMap.size === 0) {
      showToast("No lots to save for this block", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const lotsPayload = [];
      transformedLotsMap.forEach(({ coordinates, area_sqm }, lotId) => {
        lotsPayload.push({
          lot_id: lotId,
          coordinates,
          area_sqm,
        });
      });

      await axios.put(
        `${API_BASE_URL}/api/lots/batch-coordinates`,
        {
          propertyId: selectedProperty,
          lots: lotsPayload,
        },
        getAuthConfig()
      );

      showToast(
        `Successfully updated ${selectedBlock} (${lotsPayload.length} lots saved)!`,
        "success"
      );

      // Prepare matching block annotation updates before resetting transformations
      let updatedAnnotations = null;
      if (transformedAnnotationsMap.size > 0 && persistAnnotations && annotations) {
        updatedAnnotations = annotations.map((a) => {
          const aIdStr = String(a.id);
          if (transformedAnnotationsMap.has(aIdStr)) {
            const transformed = transformedAnnotationsMap.get(aIdStr);
            return {
              ...a,
              lat: transformed.lat,
              lng: transformed.lng,
              rotation: transformed.rotation,
            };
          }
          return a;
        });
      }

      // Reset local transformation states
      setScaleX(1.0);
      setScaleY(1.0);
      setOffset({ lat: 0, lng: 0 });
      setRotation(0);

      // Persist matching block annotation changes to database
      if (updatedAnnotations) {
        if (setAnnotations) {
          setAnnotations(updatedAnnotations);
        }
        await persistAnnotations(updatedAnnotations, false);
      }

      if (handleLotUpdated) {
        await handleLotUpdated();
      }
    } catch (err) {
      console.error("Error saving block coordinates:", err);
      showToast(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to save block changes",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    transformedLotsMap,
    transformedAnnotationsMap,
    selectedBlock,
    selectedProperty,
    handleLotUpdated,
    persistAnnotations,
    annotations,
    setAnnotations,
  ]);

  const handleClose = useCallback(() => {
    handleReset();
    setIsBlockAdjusting(false);
  }, [handleReset]);

  return {
    isBlockAdjusting,
    setIsBlockAdjusting,
    availableBlocks,
    selectedBlock,
    setSelectedBlock: (blk) => {
      handleReset();
      setSelectedBlock(blk);
    },
    selectedBlockLots,
    transformedLotsMap,
    transformedAnnotationsMap,
    boxGeometry,
    blockCentroid,
    scaleX,
    scaleY,
    scaleFactor: Math.round(((scaleX + scaleY) / 2) * 100) / 100,
    offset,
    rotation,
    isSaving,
    activeHandle,
    handleStartBlockDrag,
    handleStartHandleDrag,
    handleScaleChange,
    handleScaleDelta,
    handleNudge,
    handleRotateDelta,
    handleReset,
    handleSaveBlock,
    handleClose,
  };
}

export default useBlockAdjustState;
