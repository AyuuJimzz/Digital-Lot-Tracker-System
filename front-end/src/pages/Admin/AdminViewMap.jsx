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

  // States for visual coordinate editing
  const [editingLot, setEditingLot] = useState(null);
  const [editingCoords, setEditingCoords] = useState([]);
  const [isSavingCoords, setIsSavingCoords] = useState(false);

  // Handle moving a vertex on drag
  const handleVertexDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    setEditingCoords((prev) => {
      const newCoords = [...prev];
      newCoords[index] = [lat, lng];
      return newCoords;
    });
  };

  // Add a new vertex at the midpoint of the first two vertices
  const handleAddVertex = () => {
    if (editingCoords.length === 0) return;
    const p1 = editingCoords[0];
    const p2 = editingCoords[1] || p1;
    const midPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    setEditingCoords((prev) => {
      const newCoords = [...prev];
      newCoords.splice(1, 0, midPoint);
      return newCoords;
    });
  };

  // Remove a vertex by index
  const handleRemoveVertex = (index) => {
    if (editingCoords.length <= 3) {
      alert("A polygon must have at least 3 corners.");
      return;
    }
    setEditingCoords((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Create a handle icon for the draggable vertices
  const createHandleIcon = (index) => {
    return L.divIcon({
      className: "custom-handle-icon",
      html: `<div style="
        background-color: #ffffff; 
        width: 18px; 
        height: 18px; 
        border-radius: 50%;
        border: 2px solid #10b981;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: move;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: #047857;
      ">${index + 1}</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  };

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
  const selectedPropertyCoords = useMemo(() => {
    return properties.find((p) => p.id === selectedProperty)?.coordinates || [
      10.7367 + 0.0005,
      122.4998,
    ];
  }, [properties, selectedProperty]);

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

  // Listen for start visual edit event
  useEffect(() => {
    const handleStartVisualEdit = (event) => {
      const { lot_id, lot_number, property_id, coordinates } = event.detail;
      setEditingLot({ lot_id, lot_number, property_id });

      if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
        // Deep copy
        setEditingCoords(coordinates.map((c) => [...c]));
      } else {
        // Find property coordinates or fallback
        const propCoords = properties.find((p) => Number(p.id) === Number(property_id))?.coordinates || selectedPropertyCoords;
        const offset = 0.00015;
        // Make a square centered at property coordinates
        setEditingCoords([
          [propCoords[0] - offset, propCoords[1] - offset],
          [propCoords[0] + offset, propCoords[1] - offset],
          [propCoords[0] + offset, propCoords[1] + offset],
          [propCoords[0] - offset, propCoords[1] + offset],
        ]);
      }
    };

    window.addEventListener("startVisualEdit", handleStartVisualEdit);
    return () => {
      window.removeEventListener("startVisualEdit", handleStartVisualEdit);
    };
  }, [properties, selectedPropertyCoords]);

  // Handle saving visual coordinates
  const handleSaveVisualCoords = async () => {
    if (!editingLot || editingCoords.length < 3) return;

    setIsSavingCoords(true);
    try {
      await axios.put(`http://localhost:5000/api/lots/${editingLot.lot_id}/coordinates`, {
        coordinates: editingCoords,
      });

      alert("Coordinates updated successfully!");
      handleLotUpdated();
      setEditingLot(null);
    } catch (err) {
      console.error("Error saving coordinates:", err);
      alert(err.response?.data?.error || "Failed to update coordinates");
    } finally {
      setIsSavingCoords(false);
    }
  };

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div className="w-full h-full relative" style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}>
      <MapContainer
        center={selectedPropertyCoords}
        zoom={18}
        maxZoom={19}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          maxNativeZoom={18}
        />

        {filteredLots.map((lot, index) => {
          // Skip rendering original polygon if it's currently being edited visually
          if (editingLot && lot.lot_id === editingLot.lot_id) {
            return null;
          }

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

        {/* Render Editable Polygon & Draggable Handles when editing coordinates */}
        {editingLot && (
          <>
            <Polygon
              positions={editingCoords}
              pathOptions={{
                color: "#10b981",
                fillColor: "#10b981",
                fillOpacity: 0.45,
                weight: 4,
                dashArray: "6, 6",
              }}
            />
            {editingCoords.map((coord, index) => (
              <Marker
                key={`handle-${index}`}
                position={coord}
                draggable={true}
                icon={createHandleIcon(index)}
                eventHandlers={{
                  drag: (e) => handleVertexDrag(index, e),
                  dblclick: () => handleRemoveVertex(index),
                }}
              >
                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                  <div className="text-[10px] font-semibold text-gray-700 leading-tight">
                    Corner {index + 1}<br/>
                    <span className="text-[9px] text-gray-400 font-normal">Double-click to delete</span>
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        <MapController
          center={selectedPropertyCoords}
          onLotUpdated={handleLotUpdated}
          setSelectedProperty={setSelectedProperty}
          setIsPropertyChanging={setIsPropertyChanging}
        />
      </MapContainer>

      {/* Floating Coordinate Editor Panel */}
      {editingLot && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl p-4 z-[999] flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 w-11/12 max-w-lg">
          <div className="flex-1">
            <span className="font-semibold text-gray-800 dark:text-white block text-sm">
              Editing Coordinates: Lot {editingLot.lot_number}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
              Drag the green handles (1, 2, 3...) to adjust corners. Double-click a handle to delete.
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleAddVertex}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              title="Adds a new corner point to the polygon"
            >
              Add Corner
            </button>
            <button
              onClick={handleSaveVisualCoords}
              disabled={isSavingCoords}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              {isSavingCoords ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditingLot(null)}
              className="px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        selectedLot={selectedLot}
        isOpen={isOffcanvasOpen}
        onClose={() => setIsOffcanvasOpen(false)}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
        showCoordinateEdit={true}
        onStartCoordinateEdit={(lot) => {
          setIsOffcanvasOpen(false);
          window.dispatchEvent(
            new CustomEvent("startVisualEdit", {
              detail: {
                lot_id: lot.lot_id,
                lot_number: lot.lot_number,
                property_id: lot.property_id,
                coordinates: lot.coordinates,
              },
            })
          );
        }}
      />
    </div>
  );
}

export default AdminViewMap;
