import React from "react";
import { Polygon } from "react-leaflet";
import { useStableMapProps } from "../../hooks/useStableMapProps";

export function LotPlanPolygon({ pathOptions, eventHandlers, ...props }) {
  const stable = useStableMapProps(pathOptions, eventHandlers);
  return <Polygon {...props} {...stable} />;
}
