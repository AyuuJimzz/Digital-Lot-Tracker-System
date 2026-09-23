import React, { useMemo } from "react";
import { Marker, Pane } from "react-leaflet";
import L from "leaflet";

// ── Lightweight Static Overview Location Beacon (no animation = no GPU stutter) ──
export const createOverviewPropertyIcon = (name, lotCount) => {
  return L.divIcon({
    className: "property-overview-beacon-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;user-select:none;transform:translateY(-10px);">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#10b981,#047857);border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,0.4),0 4px 14px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;">
          <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
        <div style="margin-top:4px;background:rgba(15,23,42,0.95);border:1.5px solid rgba(16,185,129,0.85);padding:4px 11px;border-radius:9999px;white-space:nowrap;display:flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(0,0,0,0.65);">
          <span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block;flex-shrink:0;"></span>
          <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.3px;">${name}</span>
          ${lotCount > 0 ? `<span style="color:#6ee7b7;font-size:11px;font-weight:700;">(${lotCount})</span>` : ""}
        </div>
      </div>
    `,
    iconSize: [240, 70],
    iconAnchor: [120, 35],
  });
};

export const OverviewBeaconsLayer = ({
  properties = [],
  setSelectedProperty,
}) => {
  const beacons = useMemo(() => {
    return properties.map((property) => {
      if (
        !property.coordinates ||
        !Array.isArray(property.coordinates) ||
        property.coordinates.length < 2
      )
        return null;

      return (
        <Marker
          key={`overview-prop-${property.id}`}
          position={property.coordinates}
          icon={createOverviewPropertyIcon(property.name, property.lotCount || 0)}
          eventHandlers={{
            click: (e) => {
              if (e?.originalEvent) {
                e.originalEvent.stopPropagation();
              }
              setSelectedProperty(property.id);
              localStorage.setItem("selectedProperty", property.id.toString());
              window.dispatchEvent(
                new CustomEvent("selectProperty", {
                  detail: {
                    propertyId: property.id,
                    coordinates: property.coordinates,
                  },
                })
              );
            },
          }}
        />
      );
    });
  }, [properties, setSelectedProperty]);

  // Lot pins use Leaflet's default marker pane (z-index 600). Keep the
  // property beacon above them so dense lots cannot cover its icon or label.
  return <Pane name="property-beacons" style={{ zIndex: 625 }}>{beacons}</Pane>;
};

export default OverviewBeaconsLayer;
