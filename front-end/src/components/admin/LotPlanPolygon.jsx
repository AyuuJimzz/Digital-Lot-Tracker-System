import { createElementObject, createPathComponent, extendContext } from "@react-leaflet/core";
import { Polygon as LeafletPolygon } from "leaflet";
import React from "react";
import { useStableMapProps } from "../../hooks/useStableMapProps";

// Keep off-screen lot polygons alive in the shared SVG plane when noClip is true.
// Leaflet's default _clipPoints discards geometries when !intersects(viewport),
// which causes off-screen estates to lose their polygon fills until flight ends.
class PersistentPolygon extends LeafletPolygon {
  _clipPoints() {
    if (this.options.noClip) {
      this._parts = this._rings || [];
      return;
    }
    super._clipPoints();
  }
}

const BasePolygon = createPathComponent(
  function createPersistentPolygon({ positions, ...options }, ctx) {
    const polygon = new PersistentPolygon(positions, options);
    return createElementObject(
      polygon,
      extendContext(ctx, { overlayContainer: polygon })
    );
  },
  function updatePersistentPolygon(layer, props, prevProps) {
    if (props.positions !== prevProps.positions) {
      layer.setLatLngs(props.positions);
    }
  }
);

export function LotPlanPolygon({ pathOptions, eventHandlers, ...props }) {
  const stable = useStableMapProps(pathOptions, eventHandlers);
  return <BasePolygon {...props} {...stable} />;
}

