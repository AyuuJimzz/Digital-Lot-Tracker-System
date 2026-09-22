import { bounds, CRS, DomUtil, latLngBounds, Marker } from "leaflet";

const groups = new WeakMap();
// The current lot pin is 14px, including its border; allow ample shadow padding.
const padding = 32;

function createGroup(map) {
  const deferred = new Set();
  const group = { pins: new Set(), deferred, viewport: null };
  const flush = () => {
    // Restore exact positions before a subsequent pan, focus or interaction.
    deferred.forEach((pin) => pin.update());
    group.viewport = null;
  };
  map.on("zoomend moveend", flush);
  group.dispose = () => {
    map.off("zoomend moveend", flush);
    groups.delete(map);
  };
  return group;
}

function getViewport(map, group, event) {
  const origin = map.getPixelOrigin();
  // Leaflet gives every pin the same zoom event. Calculate the padded viewport
  // once per event, without querying DOM layout or projecting individual lots.
  if (group.viewport?.event === event && group.viewport.origin === origin) {
    return group.viewport;
  }
  const size = map.getSize();
  const pixels = bounds(
    map.containerPointToLayerPoint([-padding, -padding]),
    map.containerPointToLayerPoint([size.x + padding, size.y + padding])
  );
  group.viewport = {
    event,
    origin,
    pixels,
    coordinates: latLngBounds(
      map.layerPointToLatLng(pixels.min),
      map.layerPointToLatLng(pixels.max)
    ),
  };
  return group.viewport;
}

// Keep the normal Leaflet marker lifecycle and exact pixel rounding. Only omit
// work for offscreen lot pins during the existing fly/pinch zoom events.
export class ViewportLotMarker extends Marker {
  onAdd(map) {
    super.onAdd(map);
    let group = groups.get(map);
    if (!group) {
      group = createGroup(map);
      groups.set(map, group);
    }
    group.pins.add(this);
  }

  onRemove(map) {
    const group = groups.get(map);
    group?.deferred.delete(this);
    group?.pins.delete(this);
    if (group && group.pins.size === 0) group.dispose();
    super.onRemove(map);
  }

  update(event) {
    const map = this._map;
    const group = map && groups.get(map);
    if (group && this._icon && (event?.flyTo || event?.pinch) &&
        map.options.crs === CRS.EPSG3857 &&
        Math.abs(this._latlng.lat) <= CRS.EPSG3857.projection.MAX_LATITUDE) {
      const viewport = getViewport(map, group, event);
      const previous = DomUtil.getPosition(this._icon);
      // Check both ends: move a departing icon offscreen, and place an arriving
      // icon on this frame. No pin is hidden, removed or recreated.
      if (previous && !viewport.pixels.contains(previous) &&
          !viewport.coordinates.contains(this._latlng)) {
        group.deferred.add(this);
        return this;
      }
    }
    group?.deferred.delete(this);
    return super.update();
  }

  _animateZoom(event) {
    // Native button/keyboard CSS zooms always use Leaflet's full positioning.
    groups.get(this._map)?.deferred.delete(this);
    super._animateZoom(event);
  }
}
