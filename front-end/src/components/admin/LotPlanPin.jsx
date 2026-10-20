import { createElementObject, createLayerComponent, extendContext } from "@react-leaflet/core";
import { divIcon } from "leaflet";
import React from "react";
import { useStableMapProps } from "../../hooks/useStableMapProps";
import { ViewportLotMarker } from "../../utils/viewportLotMarker";

const pinIconCache = new Map();

/**
 * Extracts the clean lot number string from lot_number formats like:
 * "Block 1 Lot 7" -> "7"
 * "Block 17 Lot 42" -> "42"
 * "Lot 15" -> "15"
 * "Block 8 Lot 2 (Park & Playground)" -> "2"
 */
export function extractLotNumber(lotNumber) {
  if (!lotNumber) return "";
  const str = String(lotNumber).trim();
  const lotMatch = str.match(/Lot\s*#?[-]?\s*(\d+[A-Za-z]?)/i);
  if (lotMatch) return lotMatch[1];
  const numMatch = str.match(/\b(\d+[A-Za-z]?)\b/);
  if (numMatch) return numMatch[1];
  return str;
}

function getPinIcon(color, text = "") {
  const cleanText = String(text || "").trim();
  const cacheKey = `${color}__${cleanText}`;
  let icon = pinIconCache.get(cacheKey);
  if (!icon) {
    if (!cleanText) {
      icon = divIcon({
        className: "lot-plan-pin lot-plan-pin-marker",
        html: `<div style="background-color:${color};width:14px;height:14px;border-radius:50%;border:1.25px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);box-sizing:border-box;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    } else {
      const isLong = cleanText.length >= 3;
      const size = isLong ? 22 : 18;
      const half = size / 2;
      const fontSize = cleanText.length >= 3 ? 9 : (cleanText.length === 2 ? 10 : 11);

      icon = divIcon({
        className: "lot-plan-pin lot-plan-pin-marker",
        html: `<div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.65);
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          letter-spacing: -0.2px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.65);
          pointer-events: none;
          user-select: none;
        ">${cleanText}</div>`,
        iconSize: [size, size],
        iconAnchor: [half, half],
      });
    }
    pinIconCache.set(cacheKey, icon);
  }
  return icon;
}

const Pin = createLayerComponent(
  ({ center, color, text, pane, ...options }, context) => {
    const instance = new ViewportLotMarker(center, {
      ...options,
      // React-Leaflet inherits "lot-plan" from the surrounding polygon Pane.
      // Its SVG has z-index 200, which covers pins whose screen-Y z-index is
      // lower. Keep pins in the separate marker stacking context instead.
      pane: !pane || pane === "lot-plan" ? "markerPane" : pane,
      icon: getPinIcon(color, text),
      interactive: false,
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
    if (props.color !== previous.color || props.text !== previous.text) {
      layer.setIcon(getPinIcon(props.color, props.text));
    }
  }
);

export function LotPlanPin({ eventHandlers, ...props }) {
  const stable = useStableMapProps(undefined, eventHandlers);
  return <Pin {...props} {...stable} />;
}
