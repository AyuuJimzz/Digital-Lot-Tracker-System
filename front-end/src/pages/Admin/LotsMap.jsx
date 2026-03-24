import React, { useEffect, useState, useMemo } from "react";

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

import LotOffcanvas from "../../components/admin/LotOffcanvas";

import "leaflet/dist/leaflet.css";

function ZoomToCenter({ lots, propertyCoords }) {
  const map = useMap();

  useEffect(() => {
    if (propertyCoords) {
      // Always center on property coordinates, not lot bounds
      map.panTo(propertyCoords);
    } else if (lots && lots.length > 0) {
      // Fallback to lot bounds if no property coordinates provided
      const bounds = lots.map((l) => l.coordinates).flat();
      const center = L.latLngBounds(bounds).getCenter();
      map.panTo([center.lat + 0.0005, center.lng + 0.0005]);
    }
  }, [lots, map, propertyCoords]);

  return null;
}

function MapController({ selectedProperty, setSelectedProperty }) {
  const map = useMap();

  useEffect(() => {
    const handleNavigateToProperty = (event) => {
      const { coordinates } = event.detail;
      map.panTo(coordinates);
    };

    const handlePropertySelect = (event) => {
      const { propertyId } = event.detail;
      setSelectedProperty(propertyId);
    };

    window.addEventListener("navigateToProperty", handleNavigateToProperty);
    window.addEventListener("selectProperty", handlePropertySelect);

    return () => {
      window.removeEventListener("navigateToProperty", handleNavigateToProperty);
      window.removeEventListener("selectProperty", handlePropertySelect);
    };
  }, [map, setSelectedProperty]);

  return null;
}

const EstateMap = () => {
  const [mapData, setMapData] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  // Get selected property from localStorage, default to Property 1 if not found
  const [selectedProperty, setSelectedProperty] = useState(() => {
    const savedProperty = localStorage.getItem("selectedProperty");
    return savedProperty ? parseInt(savedProperty) : 1;
  });

  // Property locations (same as AdminHeader) - wrapped in useMemo to prevent re-creation on every render
  const properties = useMemo(
    () => [
      { id: 1, name: "Property 1", coordinates: [10.7367 + 0.0005, 122.4998] },
      { id: 2, name: "Property 2", coordinates: [10.737956000067012, 122.5054785697635] },
      { id: 3, name: "Property 3", coordinates: [10.671313434552875, 122.33628474716154] },
    ],
    []
  );

  useEffect(() => {
    axios

      .get("http://localhost:5000/api/lots/map-data", { withCredentials: true })

      .then((res) => setMapData(res.data))

      .catch((err) => console.error("Map Load Error:", err));
  }, []);

  // Center map on selected property when it changes
  useEffect(() => {
    if (selectedProperty) {
      const coords = properties.find((p) => p.id === selectedProperty)?.coordinates;
      if (coords) {
        // Emit event to center the map
        window.dispatchEvent(
          new CustomEvent("navigateToProperty", {
            detail: { coordinates: coords },
          })
        );
      }
    }
  }, [selectedProperty, properties]);

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Filter lots by selected property
  const filteredLots = mapData
    ? mapData.lots.filter((lot) => lot.property_id === selectedProperty)
    : [];

  // Get selected property coordinates
  const selectedPropertyCoords = properties.find((p) => p.id === selectedProperty)?.coordinates || [
    10.7367 + 0.0005,
    122.4998,
  ];

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

  // Function to handle pin click
  const handlePinClick = async (lot) => {
    // If lot is pending, fetch customer data
    if (lot.status === "Pending") {
      try {
        const lotWithCustomer = await axios.get(
          `http://localhost:5000/api/lots/${lot.lot_id}/with-customer`,
          { withCredentials: true }
        );
        setSelectedLot(lotWithCustomer.data);
      } catch (error) {
        console.error("Error fetching customer data:", error);
        setSelectedLot(lot); // Fallback to basic lot data
      }
    } else {
      setSelectedLot(lot);
    }
    setIsOffcanvasOpen(true);
  };

  // Function to close offcanvas
  const handleCloseOffcanvas = () => {
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  };

  // Function to refresh map data when lot is updated
  const handleLotUpdated = () => {
    axios
      .get("http://localhost:5000/api/lots/map-data", { withCredentials: true })
      .then((res) => setMapData(res.data))
      .catch((err) => console.error("Map Refresh Error:", err));
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

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div className="w-full h-full" style={{ height: "calc(100vh - 3.5rem)" }}>
      <MapContainer
        center={selectedPropertyCoords}
        zoom={19}
        maxZoom={22}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={22}
          maxNativeZoom={18}
        />

        {filteredLots.map((lot, index) => {
          const centerLat =
            lot.coordinates.reduce((sum, coord) => sum + coord[0], 0) / lot.coordinates.length;

          const centerLng =
            lot.coordinates.reduce((sum, coord) => sum + coord[1], 0) / lot.coordinates.length;

          const pinLat = centerLat + 0.00012;

          const statusColor = getStatusColor(lot.status);

          return (
            <React.Fragment key={index}>
              <Polygon
                positions={lot.coordinates}
                pathOptions={{
                  color: statusColor,

                  fillColor: statusColor,

                  fillOpacity: 0.6,

                  weight: 3,
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

              <Marker
                position={[pinLat, centerLng]}
                icon={createPinIcon(lot.status)}
                eventHandlers={{
                  click: () => handlePinClick(lot),
                }}
              >
                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
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

        <ZoomToCenter lots={filteredLots} propertyCoords={selectedPropertyCoords} />
        <MapController
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
        />
      </MapContainer>

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        selectedLot={selectedLot}
        isOpen={isOffcanvasOpen}
        onClose={handleCloseOffcanvas}
        onLotUpdated={handleLotUpdated}
      />
    </div>
  );
};

export default EstateMap;
