import React, { useMemo } from "react";
import { Marker, Pane } from "react-leaflet";
import L from "leaflet";

// ── Lightweight Static Overview Location Beacon (with Draggable Support for Empty Properties) ──
export const createOverviewPropertyIcon = (name, lotCount, isDraggable = false) => {
  const isNew = lotCount === 0;
  const pinBg = isNew
    ? "linear-gradient(135deg,#f59e0b,#b45309)"
    : "linear-gradient(135deg,#10b981,#047857)";
  const pinShadow = isNew
    ? "rgba(245,158,11,0.4)"
    : "rgba(16,185,129,0.4)";
  const badgeBorder = isNew
    ? "rgba(245,158,11,0.85)"
    : "rgba(16,185,129,0.85)";
  const dotBg = isNew ? "#fbbf24" : "#34d399";
  const cursor = isDraggable ? "grab" : "pointer";

  const beaconClass = [
    "property-overview-beacon-marker",
    isNew ? "property-beacon-empty" : "property-beacon-has-lots",
    isDraggable ? "property-beacon-draggable" : "",
  ].filter(Boolean).join(" ");

  return L.divIcon({
    className: beaconClass,
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:${cursor};pointer-events:auto;user-select:none;transform:translateY(-10px);">
        <div style="width:32px;height:32px;border-radius:50%;background:${pinBg};border:2.5px solid #fff;box-shadow:0 0 0 4px ${pinShadow},0 4px 14px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;">
          <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
        <div style="margin-top:4px;background:rgba(15,23,42,0.95);border:1.5px solid ${badgeBorder};padding:4px 11px;border-radius:9999px;white-space:nowrap;display:flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(0,0,0,0.65);">
          <span style="width:7px;height:7px;border-radius:50%;background:${dotBg};display:inline-block;flex-shrink:0;"></span>
          <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.3px;">${name}</span>
          ${
            lotCount > 0
              ? `<span style="color:#6ee7b7;font-size:11px;font-weight:700;">(${lotCount})</span>`
              : `<span style="color:#fcd34d;font-size:10px;font-weight:700;">${isDraggable ? "• Drag to place" : "• New"}</span>`
          }
        </div>
      </div>
    `,
    iconSize: [240, 70],
    iconAnchor: [120, 35],
  });
};

export const OverviewBeaconsLayer = ({
  properties = [],
  selectedProperty,
  setSelectedProperty,
  onPropertyMoved,
  isAdmin = true,
  currentZoom = 19,
  isAligningBlueprint = false,
}) => {
  const beacons = useMemo(() => {
    return properties.map((property) => {
      if (
        !property.coordinates ||
        !Array.isArray(property.coordinates) ||
        property.coordinates.length < 2
      )
        return null;

      // When inspecting an active property at high zoom (>= 17.5), its actual lot polygons
      // and lot pins are already visible. Hide its overview beacon so it doesn't cover lots!
      const isViewingActiveLots =
        property.lotCount > 0 &&
        currentZoom >= 17.5 &&
        Number(property.id) === Number(selectedProperty);

      // When actively uploading, previewing, or aligning a subdivision blueprint for this property,
      // hide its beacon so the pin doesn't clutter or interfere with blueprint handles & candidate lots!
      const isAligningThisProperty =
        isAligningBlueprint && Number(property.id) === Number(selectedProperty);

      if (isViewingActiveLots || isAligningThisProperty) return null;

      // Only empty properties (0 lots) are draggable by Admin to position their beacon before plotting lots.
      // Green properties with mapped lots are permanently anchored and MUST NEVER be draggable!
      const isDraggable = isAdmin && Number(property.lotCount || 0) === 0;

      return (
        <Marker
          key={`overview-prop-${property.id}`}
          pane="property-beacons"
          position={property.coordinates}
          draggable={isDraggable}
          icon={createOverviewPropertyIcon(
            property.name,
            property.lotCount || 0,
            isDraggable
          )}
          eventHandlers={{
            click: (e) => {
              if (e?.originalEvent) {
                e.originalEvent.stopPropagation();
              }
              // If already zoomed in (currentZoom >= 18) on this property, avoid duplicate navigation jump.
              // But if zoomed out in overview, clicking the beacon should always zoom straight in!
              if (Number(selectedProperty) === Number(property.id) && currentZoom >= 18) {
                return;
              }
              setSelectedProperty(property.id);
              localStorage.setItem("selectedProperty", property.id.toString());
              window.dispatchEvent(
                new CustomEvent("selectProperty", {
                  detail: {
                    propertyId: property.id,
                    coordinates: property.coordinates,
                    straight: true,
                    fromBeaconClick: true,
                  },
                })
              );
            },
            dragend: (e) => {
              const marker = e.target;
              if (!marker) return;
              const newPos = marker.getLatLng();
              // Prevent accidental micro-drag or click jitter from relocating property
              if (
                property.coordinates &&
                Array.isArray(property.coordinates) &&
                property.coordinates.length >= 2
              ) {
                const movedDistanceMeters = L.latLng(property.coordinates).distanceTo(newPos);
                if (movedDistanceMeters < 15) {
                  marker.setLatLng(property.coordinates);
                  return;
                }
              }
              onPropertyMoved?.(property.id, [newPos.lat, newPos.lng]);
            },
          }}
        />
      );
    });
  }, [properties, selectedProperty, setSelectedProperty, onPropertyMoved, isAdmin, currentZoom, isAligningBlueprint]);

  // Lot pins use Leaflet's default marker pane (z-index 600). Keep the
  // property beacon above them so dense lots cannot cover its icon or label.
  return <Pane name="property-beacons" style={{ zIndex: 625 }}>{beacons}</Pane>;
};

export default OverviewBeaconsLayer;
