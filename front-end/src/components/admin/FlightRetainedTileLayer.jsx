import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from "@react-leaflet/core";
import { DomEvent, TileLayer as LeafletTileLayer, Util } from "leaflet";

// Leaflet normally aborts requests from the previous integer zoom as soon as a
// new level is created. A custom requestAnimationFrame flight can cross several
// levels before cold requests resolve, leaving the new level transparent.
class FlightRetainedLeafletTileLayer extends LeafletTileLayer {
  createTile(coords, done) {
    const tile = document.createElement("img");
    DomEvent.on(tile, "load", Util.bind(this._tileOnLoad, this, done, tile));
    DomEvent.on(tile, "error", Util.bind(this._tileOnError, this, done, tile));
    if (this.options.crossOrigin || this.options.crossOrigin === "") {
      tile.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
    }
    if (typeof this.options.referrerPolicy === "string") tile.referrerPolicy = this.options.referrerPolicy;
    tile.alt = "";
    tile.decoding = "async";
    if (this.options.fetchPriority) tile.fetchPriority = this.options.fetchPriority;
    // Priority must be assigned before src; changing it in tileloadstart is too late
    // because Leaflet has already initiated the network request by then.
    tile.src = this.getTileUrl(coords);
    return tile;
  }

  onAdd(map) {
    this._retainForPropertyFlight = false;
    this._startFlightRetention = () => {
      this._retainForPropertyFlight = true;
      this._noPrune = true;
    };
    this._endFlightRetention = () => {
      this._retainForPropertyFlight = false;
      this._noPrune = false;
      if (!this._map) return;
      LeafletTileLayer.prototype._abortLoading.call(this);
      this._pruneTiles();
    };
    map.on("propertyflightstart", this._startFlightRetention);
    map.on("propertyflightend", this._endFlightRetention);
    return super.onAdd(map);
  }

  onRemove(map) {
    map.off("propertyflightstart", this._startFlightRetention);
    map.off("propertyflightend", this._endFlightRetention);
    return super.onRemove(map);
  }

  _abortLoading() {
    if (!this._retainForPropertyFlight) super._abortLoading();
  }

  _pruneTiles() {
    if (!this._retainForPropertyFlight) super._pruneTiles();
  }
}

export const FlightRetainedTileLayer = createTileLayerComponent(
  ({ url, ...options }, context) => createElementObject(
    new FlightRetainedLeafletTileLayer(url, withPane(options, context)),
    context
  ),
  (layer, props, previous) => {
    updateGridLayer(layer, props, previous);
    if (props.url != null && props.url !== previous.url) layer.setUrl(props.url);
  }
);
