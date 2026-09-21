import { useEffect } from "react";
import { attachSmoothWheelZoom } from "../utils/smoothWheelZoom";

export function useSmoothWheelZoom(map) {
  useEffect(() => map ? attachSmoothWheelZoom(map) : undefined, [map]);
}

export default useSmoothWheelZoom;
