import React, { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  useMap,
  Marker,
  Polyline,
  Tooltip,
} from "react-leaflet";

import axios from "axios";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

// Automatically centers the map on the lots without changing zoom

function ZoomToCenter({ lots }) {
  const map = useMap();

  useEffect(() => {
    if (lots && lots.length > 0) {
      const bounds = lots.map((l) => l.coordinates).flat();

      const center = L.latLngBounds(bounds).getCenter();
      map.panTo([center.lat - 0.0002, center.lng + 0.0005]);
    }
  }, [lots, map]);

  return null;
}

const EstateMap = () => {
  const [mapData, setMapData] = useState(null);

  useEffect(() => {
    axios

      .get("http://localhost:5000/api/lots/map-data", { withCredentials: true })

      .then((res) => setMapData(res.data))

      .catch((err) => console.error("Map Load Error:", err));
  }, []);

  // Helper function to get color based on status

  const getStatusColor = (status) => {
    switch (status) {
      case "Available":
        return "#22c55e";

      case "Pending":
        return "#eab308";

      case "Sold":
        return "#ef4444";

      default:
        return "#94a3b8";
    }
  };

  // Function to create the Pin Icon

  const createPinIcon = (status) => {
    const color = getStatusColor(status);

    return L.divIcon({
      className: "custom-pin",

      html: `<div style="

        background-color: ${color}; 

        width: 16px; 

        height: 16px; 

        border-radius: 50%;

        border: 1px solid #fff;

        box-shadow: 0 2px 6px rgba(0,0,0,0.5);

        cursor: pointer;

        transition: all 0.2s ease;

      ":hover="

        transform: scale(1.2);

        box-shadow: 0 3px 8px rgba(0,0,0,0.7);

      "></div>`,

      iconSize: [16, 16],

      iconAnchor: [8, 8], // Center of the circle
    });
  };

  if (!mapData)
    return (
      <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>
    );

  return (
    <div className="w-full h-full" style={{ height: "calc(100vh - 3.5rem)" }}>
      <MapContainer
        center={[10.7367 + 0.0005, 122.4998]}
        zoom={20}
        maxZoom={22}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={22}
          maxNativeZoom={18}
        />

        {mapData.lots.map((lot, index) => {
          const centerLat =
            lot.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
            lot.coordinates.length;

          const centerLng =
            lot.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
            lot.coordinates.length;

          const pinLat = centerLat + 0.00012;

          const statusColor = getStatusColor(lot.status);

          return (
            <React.Fragment key={index}>
              <Polygon
                positions={lot.coordinates}
                pathOptions={{
                  color: statusColor,

                  fillColor: statusColor,

                  fillOpacity: 0.4,

                  weight: 2,
                }}
              >
                <Popup>
                  <div>
                    <strong>{lot.lot_number}</strong>
                    <br />
                    Area: {lot.area_sqm} SQM
                    <br />
                    Status:{" "}
                    <strong style={{ color: statusColor }}>{lot.status}</strong>
                  </div>
                </Popup>
              </Polygon>

              <Polyline
                positions={[
                  [centerLat, centerLng],

                  [pinLat, centerLng],
                ]}
                pathOptions={{
                  color: "#ffffff",

                  weight: 1,

                  dashArray: "2, 4",

                  opacity: 0.7,
                }}
              />

              <Marker
                position={[pinLat, centerLng]}
                icon={createPinIcon(lot.status)}
              >
                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                  <div className="text-center text-xs leading-tight">
                    <div className="mb-1">{lot.lot_number}</div>

                    <div className="mb-1 text-[12px] font-bold text-gray-600">
                      {lot.area_sqm} sqm
                    </div>

                    <div
                      className="mb-1 text-[12px] font-bold"
                      style={{ color: statusColor }}
                    >
                      {lot.status}
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}

        <ZoomToCenter lots={mapData.lots} />
      </MapContainer>
    </div>
  );
};

export default EstateMap;
