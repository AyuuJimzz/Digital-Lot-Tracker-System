import L from "leaflet";

/**
 * Computes the arithmetic centroid (average lat, average lng) of a polygon
 * @param {Array<[number, number]>} coords 
 * @returns {[number, number]}
 */
export const getPolygonCentroid = (coords) => {
  if (!coords || coords.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLng = 0;
  for (let i = 0; i < coords.length; i++) {
    sumLat += coords[i][0];
    sumLng += coords[i][1];
  }
  return [sumLat / coords.length, sumLng / coords.length];
};

/**
 * Creates Leaflet divIcon for the '+' vertex insertion handle between two corners
 * @returns {L.DivIcon}
 */
export const createMidpointIcon = (color = "#06b6d4", glowColor = "rgba(6, 182, 212, 0.45)") => {
  return L.divIcon({
    className: "custom-midpoint-icon",
    html: `
      <div style="
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: ${color};
        border: 1.5px solid #ffffff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 6px ${glowColor};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #ffffff;
        font-size: 11px;
        font-weight: bold;
        line-height: 1;
        transition: transform 0.15s ease-in-out;
      " onmouseover="this.style.transform='scale(1.2)';" onmouseout="this.style.transform='scale(1)';">
        +
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

/**
 * Creates Leaflet divIcon for the center 4-way arrow handle used to drag the entire lot
 * @returns {L.DivIcon}
 */
export const createPolygonCenterMoveIcon = (color = "#06b6d4", glowColor = "rgba(6, 182, 212, 0.45)") => {
  return L.divIcon({
    className: "custom-polygon-center-icon",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(15, 23, 42, 0.9);
        border: 2px solid ${color};
        box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${glowColor};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        color: ${color};
        user-select: none;
      " title="Drag to move entire lot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="5 9 2 12 5 15"></polyline>
          <polyline points="9 5 12 2 15 5"></polyline>
          <polyline points="15 19 12 22 9 19"></polyline>
          <polyline points="19 9 22 12 19 15"></polyline>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

/**
 * Creates Leaflet divIcon for an individual polygon vertex corner with index badge
 * @param {number} index - 0-based corner index
 * @returns {L.DivIcon}
 */
export const createHandleIcon = (
  index,
  color = "#06b6d4",
  badgeColor = "#0891b2",
  ringColor = "rgba(6, 182, 212, 0.25)",
  glowColor = "rgba(6, 182, 212, 0.45)"
) => {
  return L.divIcon({
    className: "custom-handle-icon",
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        user-select: none;
      ">
        <div style="
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px dashed ${color};
          background-color: ${ringColor};
          pointer-events: none;
          box-shadow: 0 0 8px ${glowColor};
        "></div>
        
        <div style="
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 0 4px rgba(0,0,0,0.6);
          pointer-events: none;
          z-index: 2;
        "></div>
        
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          background-color: ${badgeColor};
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          min-width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          z-index: 3;
          pointer-events: none;
        ">
          ${index + 1}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};
