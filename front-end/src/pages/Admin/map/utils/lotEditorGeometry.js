/**
 * Generates initial 4-point polygon square oriented along the blueprint's rotation angle
 * @param {[number, number]} centerCoords - [lat, lng] center
 * @param {number} areaSqm - Target area in square meters
 * @param {number} overlayRotation - Rotation in degrees
 * @returns {Array<[number, number]>} Array of 4 [lat, lng] coordinates
 */
export const generateInitialLotSquare = (centerCoords, areaSqm = 100, overlayRotation = 0) => {
  const sideMeters = Math.sqrt(areaSqm);
  const latRad = (centerCoords[0] * Math.PI) / 180;
  const dLat = (sideMeters / 2) / 111320;
  const dLng = (sideMeters / 2) / (111320 * Math.cos(latRad));

  const rotRad = ((overlayRotation || 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  const corners = [
    [-dLat, -dLng],
    [dLat, -dLng],
    [dLat, dLng],
    [-dLat, dLng],
  ];

  return corners.map(([dy, dx]) => {
    const rotY = dy * cosR - dx * sinR;
    const rotX = dy * sinR + dx * cosR;
    return [centerCoords[0] + rotY, centerCoords[1] + rotX];
  });
};

/**
 * Scales polygon coordinates relative to its geometric center
 * @param {Array<[number, number]>} coords 
 * @param {number} factor - Scale factor (e.g. 1.05 or 0.95)
 * @returns {Array<[number, number]>}
 */
export const scalePolygonCoords = (coords, factor) => {
  if (!coords || coords.length === 0) return coords;
  let sumLat = 0;
  let sumLng = 0;
  coords.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });
  const cLat = sumLat / coords.length;
  const cLng = sumLng / coords.length;

  return coords.map(([lat, lng]) => [
    cLat + (lat - cLat) * factor,
    cLng + (lng - cLng) * factor,
  ]);
};

/**
 * Resets polygon to a perfect square around its current center or fallback center
 * @param {Array<[number, number]>} coords 
 * @param {number} targetArea 
 * @param {number} overlayRotation 
 * @param {[number, number]} fallbackCenter 
 * @returns {Array<[number, number]>}
 */
export const resetPolygonToSquare = (coords, targetArea = 100, overlayRotation = 0, fallbackCenter = null) => {
  let cLat, cLng;
  if (coords && coords.length > 0) {
    let sumLat = 0;
    let sumLng = 0;
    coords.forEach(([lat, lng]) => {
      sumLat += lat;
      sumLng += lng;
    });
    cLat = sumLat / coords.length;
    cLng = sumLng / coords.length;
  } else if (fallbackCenter) {
    cLat = fallbackCenter[0];
    cLng = fallbackCenter[1];
  } else {
    cLat = 10.7372;
    cLng = 122.3857;
  }

  return generateInitialLotSquare([cLat, cLng], targetArea, overlayRotation);
};
