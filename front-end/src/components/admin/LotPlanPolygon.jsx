import { createElementObject, createPathComponent, extendContext } from "@react-leaflet/core";
import { Polygon as LeafletPolygon } from "leaflet";
import React from "react";
import { useStableMapProps } from "../../hooks/useStableMapProps";

const BasePolygon = createPathComponent(
  function createLotPolygon({ positions, ...options }, ctx) {
    const polygon = new LeafletPolygon(positions, options);
    return createElementObject(
      polygon,
      extendContext(ctx, { overlayContainer: polygon })
    );
  },
  function updateLotPolygon(layer, props, prevProps) {
    if (props.positions !== prevProps.positions) {
      layer.setLatLngs(props.positions);
    }
  }
);

export function LotPlanPolygon({ pathOptions, eventHandlers, ...props }) {
  const stable = useStableMapProps(pathOptions, eventHandlers);
  return <BasePolygon {...props} {...stable} />;
}
