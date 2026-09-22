import { createElementObject, createLayerComponent, extendContext } from "@react-leaflet/core";
import { divIcon } from "leaflet";
import React from "react";
import { useStableMapProps } from "../../hooks/useStableMapProps";
import { ViewportLotMarker } from "../../utils/viewportLotMarker";

const pinIconCache = new Map();

function getPinIcon(color) {
  let icon = pinIconCache.get(color);
  if (!icon) {
    icon = divIcon({
      className: "lot-plan-pin lot-plan-pin-marker",
      html: `<div style="background-color:${color};width:14px;height:14px;border-radius:50%;border:1.25px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);box-sizing:border-box;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    pinIconCache.set(color, icon);
  }
  return icon;
}

const Pin = createLayerComponent(
  ({ center, color, pane, ...options }, context) => {
    const instance = new ViewportLotMarker(center, {
      ...options,
      pane: pane || "markerPane",
      icon: getPinIcon(color),
    });
    return createElementObject(
      instance,
      extendContext(context, { overlayContainer: instance })
    );
  },
  (layer, props, previous) => {
    if (
      props.center &&
      previous.center &&
      (props.center[0] !== previous.center[0] ||
        props.center[1] !== previous.center[1])
    ) {
      layer.setLatLng(props.center);
    }
    if (props.color !== previous.color) {
      layer.setIcon(getPinIcon(props.color));
    }
  }
);

export function LotPlanPin({ eventHandlers, ...props }) {
  const stable = useStableMapProps(undefined, eventHandlers);
  return <Pin {...props} {...stable} />;
}
