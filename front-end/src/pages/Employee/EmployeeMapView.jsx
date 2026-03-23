import React, { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function ZoomToCenter({ lots }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(lots) || lots.length === 0) return;

    const bounds = lots.map((lot) => lot.coordinates).flat();
    const center = L.latLngBounds(bounds).getCenter();
    map.panTo([center.lat + 0.0005, center.lng + 0.0005]);
  }, [lots, map]);

  return null;
}

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
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const EmployeeMapView = () => {
  const [mapData, setMapData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/lots/map-data", { withCredentials: true })
      .then((response) => setMapData(response.data))
      .catch(() => setError("Unable to load map data."));
  }, []);

  if (error) {
    return <div className="p-5 text-sm text-red-600">{error}</div>;
  }

  if (!mapData) {
    return <div className="p-5 text-sm text-gray-600">Loading Map View...</div>;
  }

  return (
    <div className="w-full h-full bg-gray-50" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="px-4 pt-3 pb-2">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <span className="font-semibold text-gray-900 mr-1">Status</span>
            <span className="rounded-md bg-gray-100 px-2 py-1">
              Total: {mapData.summary?.totalLots ?? 0}
            </span>
            <span className="rounded-md bg-green-50 px-2 py-1 text-green-700">
              Available: {mapData.summary?.availableLots ?? 0}
            </span>
            <span className="rounded-md bg-yellow-50 px-2 py-1 text-yellow-700">
              Pending: {mapData.summary?.pendingLots ?? 0}
            </span>
            <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">
              Sold: {mapData.summary?.soldLots ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4" style={{ height: "calc(100% - 64px)" }}>
        <div className="h-full w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm">
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

            {mapData.lots.map((lot) => {
              const centerLat =
                lot.coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) /
                lot.coordinates.length;
              const centerLng =
                lot.coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
                lot.coordinates.length;
              const pinLat = centerLat + 0.00012;
              const statusColor = getStatusColor(lot.status);

              return (
                <React.Fragment key={lot.lot_id}>
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
                        Status: <strong style={{ color: statusColor }}>{lot.status}</strong>
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

                  <Marker position={[pinLat, centerLng]} icon={createPinIcon(lot.status)}>
                    <Tooltip direction="top" offset={[0, -10]}>
                      <div className="text-center text-xs leading-tight">
                        <div className="mb-1">{lot.lot_number}</div>
                        <div className="mb-1 text-[12px] font-bold text-gray-600">
                          {lot.area_sqm} sqm
                        </div>
                        <div className="mb-1 text-[12px] font-bold" style={{ color: statusColor }}>
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
      </div>
    </div>
  );
};

export default EmployeeMapView;
