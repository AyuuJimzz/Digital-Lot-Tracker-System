// Use the polygon's bounding box, not its center: a partially visible lot must stay mounted.
export function getLotBounds(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return null;
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const point of coordinates) {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    south = Math.min(south, point[0]);
    north = Math.max(north, point[0]);
    west = Math.min(west, point[1]);
    east = Math.max(east, point[1]);
  }
  return { south, north, west, east };
}

export function lotIntersectsBounds(lotBounds, viewBounds, offset = { lat: 0, lng: 0 }) {
  return lotBounds &&
    lotBounds.north + offset.lat >= viewBounds.getSouth() &&
    lotBounds.south + offset.lat <= viewBounds.getNorth() &&
    lotBounds.east + offset.lng >= viewBounds.getWest() &&
    lotBounds.west + offset.lng <= viewBounds.getEast();
}
