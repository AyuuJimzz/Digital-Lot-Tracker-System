import L from "leaflet";

/**
 * Computes exact 4 GPS corners of the rotated blueprint image
 */
export const getRotatedBlueprintCorners = (bounds, rotationDeg, unrotatedSpan) => {
  if (!bounds || bounds.length < 2) return null;
  const cLat = (bounds[0][0] + bounds[1][0]) / 2;
  const cLng = (bounds[0][1] + bounds[1][1]) / 2;

  let baseLatSpan = unrotatedSpan ? unrotatedSpan.latSpan : Math.abs(bounds[1][0] - bounds[0][0]);
  let baseLngSpan = unrotatedSpan ? unrotatedSpan.lngSpan : Math.abs(bounds[1][1] - bounds[0][1]);
  const halfLat = baseLatSpan / 2;
  const halfLng = baseLngSpan / 2;

  const rad = ((rotationDeg || 0) * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const rotateOffset = (dLat, dLng) => {
    const rotLat = dLat * cos - dLng * sin;
    const rotLng = dLng * cos + dLat * sin;
    return [cLat + rotLat, cLng + rotLng];
  };

  return {
    nw: rotateOffset(halfLat, -halfLng),
    ne: rotateOffset(halfLat, halfLng),
    se: rotateOffset(-halfLat, halfLng),
    sw: rotateOffset(-halfLat, -halfLng),
  };
};

/**
 * Creates amber corner handle icon for overlay alignment
 */
export const createOverlayCornerIcon = (label) => {
  return L.divIcon({
    className: "overlay-corner-icon",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background-color: #f59e0b;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        color: #ffffff;
        font-size: 7px;
        font-weight: bold;
        letter-spacing: -0.5px;
      ">${label}</div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

/**
 * Creates purple center-move icon for overlay alignment
 */
export const createOverlayCenterIcon = () => {
  return L.divIcon({
    className: "overlay-center-icon",
    html: `
      <div style="
        width: 30px; height: 30px; border-radius: 50%;
        background-color: #7c3aed;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        cursor: move;
      ">
        <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
          <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-13 4h-4v3H3l5 5 5-5h-3v-3z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};
