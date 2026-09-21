import { createElementObject, createPathComponent, extendContext } from "@react-leaflet/core";
import { Circle } from "leaflet";
import React from "react";
import { useStableMapProps } from "../../hooks/useStableMapProps";

// Keep the path even when its property starts outside the viewport. The shared
// SVG renderer moves it into view during flyTo without recreating marker DOM.
class LotCircle extends Circle {
  _empty() { return false; }
}

const Pin = createPathComponent(
  ({ center, color, children, ...options }, context) => {
    const instance = new LotCircle(center, {
      ...options, radius: 2, color: "#fff", weight: 1.25,
      fillColor: color, fillOpacity: 1, className: "lot-plan-pin",
    });
    return createElementObject(instance, extendContext(context, { overlayContainer: instance }));
  },
  (layer, props, previous) => {
    if (props.center[0] !== previous.center[0] || props.center[1] !== previous.center[1]) {
      layer.setLatLng(props.center);
    }
    if (props.color !== previous.color) layer.setStyle({ fillColor: props.color });
  }
);

export function LotPlanPin({ eventHandlers, ...props }) {
  const stable = useStableMapProps(undefined, eventHandlers);
  return <Pin {...props} {...stable} />;
}
