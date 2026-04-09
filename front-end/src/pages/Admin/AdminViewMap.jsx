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

// Fix for default icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Component to handle map centering and event listening
function MapController({ center, onLotUpdated, setSelectedProperty, setIsPropertyChanging }) {
  const map = useMap();

  useEffect(() => {
    // Listen for property navigation events
    const handleNavigateToProperty = (event) => {
      const { coordinates } = event.detail;

      // Validate coordinates before setting map view
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.error("Invalid coordinates for navigation:", coordinates);
        return;
      }

      map.panTo(coordinates);
    };

    // Listen for property selection events
    const handleSelectProperty = (event) => {
      const { propertyId } = event.detail;
      setSelectedProperty(propertyId);
      // Set flag to indicate this is a user-initiated property change
      setIsPropertyChanging(true);
    };

    window.addEventListener("navigateToProperty", handleNavigateToProperty);
    window.addEventListener("selectProperty", handleSelectProperty);

    return () => {
      window.removeEventListener("navigateToProperty", handleNavigateToProperty);
      window.removeEventListener("selectProperty", handleSelectProperty);
    };
  }, [map, setSelectedProperty, setIsPropertyChanging]);

  useEffect(() => {
    // Remove automatic centering to prevent map movement when offcanvas opens
    // Map will only move when user explicitly navigates to a property
    return () => {};
  }, [center, map]);

  return null;
}

function AdminViewMap() {
  const [mapData, setMapData] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    return parseInt(localStorage.getItem("selectedProperty")) || 1;
  });
  // Track if property change is due to user interaction vs lot click
  const [isPropertyChanging, setIsPropertyChanging] = useState(false);

  // Property locations
  const properties = useMemo(
    () => [
      { id: 1, name: "Property 1", coordinates: [10.7367 + 0.0005, 122.4998] },
      { id: 2, name: "Property 2", coordinates: [10.737956000067012, 122.5054785697635] },
      { id: 3, name: "Property 3", coordinates: [10.671313434552875, 122.33628474716154] },
    ],
    []
  );

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Center map on selected property when it changes (but only due to user interaction)
  useEffect(() => {
    if (selectedProperty && isPropertyChanging) {
      const coords = properties.find((p) => p.id === selectedProperty)?.coordinates;
      if (coords) {
        const timer = setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("navigateToProperty", {
              detail: { coordinates: coords },
            })
          );
          setIsPropertyChanging(false); // Reset the flag
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [selectedProperty, properties, isPropertyChanging]);

  // Show all lots from all properties
  const filteredLots = mapData ? mapData.lots : [];

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
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      ":hover="
        transform: translate(-50%, -50%) scale(1.2);
        box-shadow: 0 3px 8px rgba(0,0,0,0.7);
      "></div>`,

      iconSize: [24, 24], // Larger clickable area

      iconAnchor: [12, 24], // Anchor at bottom center of the clickable area
    });
  };

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get("http://localhost:5000/api/lots/map-data", { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`http://localhost:5000/api/lots/${lot.lot_id}`, {
                  withCredentials: true,
                });
                return { ...lot, customer: lotDetails.data.customer };
              } catch (error) {
                console.error(`Error fetching customer data for lot ${lot.lot_id}:`, error);
                return lot;
              }
            }
            return lot;
          })
        );

        setMapData({ ...mapResponse.data, lots: lotsWithCustomerData });
      } catch (err) {
        console.error("Map Data Error:", err);
      }
    };

    fetchMapData();
  }, []);

  // Function to refresh map data when lot is updated
  const handleLotUpdated = () => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get("http://localhost:5000/api/lots/map-data", { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`http://localhost:5000/api/lots/${lot.lot_id}`, {
                  withCredentials: true,
                });
                return { ...lot, customer: lotDetails.data.customer };
              } catch (error) {
                console.error(`Error fetching customer data for lot ${lot.lot_id}:`, error);
                return lot;
              }
            }
            return lot;
          })
        );

        setMapData({ ...mapResponse.data, lots: lotsWithCustomerData });
      } catch (err) {
        console.error("Map Refresh Error:", err);
      }
    };

    fetchMapData();
  };

  // Listen for coordinate updates from AdminHeader
  useEffect(() => {
    const handleRefreshMapData = () => {
      handleLotUpdated();
    };

    window.addEventListener("refreshMapData", handleRefreshMapData);

    return () => {
      window.removeEventListener("refreshMapData", handleRefreshMapData);
    };
  }, []);

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
          // Skip lots with invalid or missing coordinates
          if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
            console.warn(
              `Lot ${lot.lot_id} (${lot.lot_number}) has invalid coordinates, skipping...`
            );
            return null;
          }

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
                  click: async (e) => {
                    e.originalEvent.stopPropagation();
                    // Prevent any property navigation when clicking on lots
                    e.originalEvent.preventDefault();

                    // Set basic lot data immediately to ensure it's available
                    setSelectedLot(lot);
                    setIsOffcanvasOpen(true);

                    // Then fetch fresh data in background
                    try {
                      const lotDetails = await axios.get(
                        `http://localhost:5000/api/lots/${lot.lot_id}`,
                        {
                          withCredentials: true,
                        }
                      );
                      setSelectedLot(lotDetails.data);
                    } catch (err) {
                      console.error("Lot Details Error:", err);
                      // Keep the basic lot data if fetch fails
                    }
                  },
                }}
              >
                <Tooltip permanent={false} direction="top" offset={[0, -32]}>
                  <div className="text-center text-xs leading-tight">
                    <div className="mb-1 font-bold">Lot ID: {lot.lot_id}</div>
                    <div className="mb-1 font-bold">{lot.lot_number}</div>
                    <div className="mb-1 text-[12px] text-gray-600">{lot.area_sqm} sqm</div>
                    <div className="mb-1 text-[12px] font-bold" style={{ color: statusColor }}>
                      {lot.status}
                    </div>
                    {(lot.status === "Pending" || lot.status === "Sold") && lot.customer && (
                      <>
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <div className="text-[11px] text-gray-700">
                            <div className="font-semibold">Customer Info:</div>
                            <div>{lot.customer.full_name || "N/A"}</div>
                            <div className="text-gray-600">{lot.customer.email || "N/A"}</div>
                            <div className="text-gray-600">
                              {lot.customer.contact_number || "N/A"}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}

        <MapController
          center={selectedPropertyCoords}
          onLotUpdated={handleLotUpdated}
          setSelectedProperty={setSelectedProperty}
          setIsPropertyChanging={setIsPropertyChanging}
        />
      </MapContainer>

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        selectedLot={selectedLot}
        isOpen={isOffcanvasOpen}
        onClose={() => setIsOffcanvasOpen(false)}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
      />
    </div>
  );
}

export default AdminViewMap;
