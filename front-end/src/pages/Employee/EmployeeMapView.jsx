import { API_BASE_URL } from "../../config/api";
import React, { useEffect, useState, useMemo, useRef } from "react";

import {
  MapContainer,
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
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import {
  MapLayerControls,
  ActiveMapTileLayer,
  MAP_LAYERS,
} from "../../components/admin/MapLayerControls";
import { geocodeAddress } from "../../utils/geocoding";

import "leaflet/dist/leaflet.css";

const DEFAULT_COORDINATES_MAP = {
  1: [10.7372, 122.4998], // LOT-3896 Oton Cadastre
  2: [10.737956, 122.505478], // Lot-2018 Oton Cadestra
  3: [10.671313, 122.335284], // Lot-204 Nanga Guimbal
};

const MUNICIPALITY_COORDINATES = {
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7372, 122.4998],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "pavia": [10.7744, 122.5408],
  "santa barbara": [10.8242, 122.5342],
  "leganes": [10.7833, 122.5833],
  "dumangas": [10.8250, 122.7167],
  "zarraga": [10.8217, 122.6108],
  "pototan": [10.9472, 122.6289],
  "janiuay": [10.9575, 122.5022],
  "miagao": [10.6444, 122.2358],
  "san joaquin": [10.5878, 122.1408],
  "tigbauan": [10.6756, 122.3811],
  "iloilo": [10.7202, 122.5621],
  "passi": [11.1075, 122.6419],
};

// Component to handle map centering, smooth flyTo animation, and event listening
function MapController({
  setSelectedProperty,
  setMap,
}) {
  const map = useMap();

  useEffect(() => {
    if (setMap) {
      setMap(map);
    }
  }, [map, setMap]);

  // Ensure map recalculates its exact full-screen dimensions to prevent grey/unrendered tiles
  useEffect(() => {
    if (!map) return;
    map.invalidateSize();

    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  // Initial subtle smooth cinematic zoom-out animation when opening Map View
  useEffect(() => {
    if (!map) return;
    const initialCenter = map.getCenter();
    const t = setTimeout(() => {
      map.flyTo(initialCenter, 18.2, { duration: 1.4, easeLinearity: 0.25 });
    }, 200);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    // Listen for property navigation events with smooth zoom out / glide flyTo animation
    const handleNavigateToProperty = (event) => {
      const { coordinates } = event.detail;

      // Validate coordinates before setting map view
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.error("Invalid coordinates for navigation:", coordinates);
        return;
      }

      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const dist = Math.hypot(
        currentCenter.lat - coordinates[0],
        currentCenter.lng - coordinates[1]
      );

      // If already viewing this location, toggle subtle zoom out (18) or zoom in (19)
      if (dist < 0.002) {
        if (currentZoom >= 18.8) {
          map.flyTo(coordinates, 18, { duration: 1.2, easeLinearity: 0.25 });
        } else {
          map.flyTo(coordinates, 19.2, { duration: 1.2, easeLinearity: 0.25 });
        }
      } else {
        map.flyTo(coordinates, 18.5, { duration: 1.4, easeLinearity: 0.25 });
      }
    };

    // Listen for toggle zoom out / in when clicking Map View
    const handleToggleMapOverview = () => {
      if (!map) return;
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      if (currentZoom >= 18.8) {
        map.flyTo(currentCenter, 18, { duration: 1.2, easeLinearity: 0.25 });
      } else {
        map.flyTo(currentCenter, 19.2, { duration: 1.2, easeLinearity: 0.25 });
      }
    };

    // Listen for property selection events
    const handleSelectProperty = (event) => {
      const { propertyId } = event.detail;
      setSelectedProperty(propertyId);
    };

    window.addEventListener("navigateToProperty", handleNavigateToProperty);
    window.addEventListener("toggleMapOverview", handleToggleMapOverview);
    window.addEventListener("selectProperty", handleSelectProperty);

    return () => {
      window.removeEventListener("navigateToProperty", handleNavigateToProperty);
      window.removeEventListener("toggleMapOverview", handleToggleMapOverview);
      window.removeEventListener("selectProperty", handleSelectProperty);
    };
  }, [map, setSelectedProperty]);

  return null;
}

const EmployeeMapView = () => {
  const [mapData, setMapData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("mapDataCache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [map, setMap] = useState(null);
  const mapWrapperRef = useRef(null);
  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem("preferredMapLayer") || MAP_LAYERS.SATELLITE;
  });

  // Get selected property from localStorage, default to Property 1 if not found
  const [selectedProperty, setSelectedProperty] = useState(() => {
    const savedProperty = localStorage.getItem("selectedProperty");
    return savedProperty ? parseInt(savedProperty) : 1;
  });

  // Property locations (same as AdminHeader) - derived from mapData or fallback
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties.map((p) => {
        let coords = DEFAULT_COORDINATES_MAP[p.property_id];
        const propLots = (mapData.lots || []).filter(
          (l) => l.property_id === p.property_id && l.coordinates && l.coordinates.length > 0
        );

        if (propLots.length > 0) {
          let sumLat = 0;
          let sumLng = 0;
          let totalPts = 0;
          propLots.forEach((l) => {
            l.coordinates.forEach(([lat, lng]) => {
              sumLat += lat;
              sumLng += lng;
              totalPts++;
            });
          });
          if (totalPts > 0) {
            coords = [sumLat / totalPts, sumLng / totalPts];
            try {
              localStorage.setItem(
                "propertyCustomCoords_" + p.property_id,
                JSON.stringify(coords)
              );
            } catch (e) {}
          }
        } else {
          try {
            const cachedCoords = localStorage.getItem("propertyCustomCoords_" + p.property_id);
            if (cachedCoords) {
              coords = JSON.parse(cachedCoords);
            }
          } catch (e) {}

          // Check municipality town database
          if (!coords) {
            const locationText = `${p.location || ""} ${p.property_name || ""}`.toLowerCase();
            for (const [key, townCoords] of Object.entries(MUNICIPALITY_COORDINATES)) {
              if (locationText.includes(key)) {
                coords = townCoords;
                try {
                  localStorage.setItem(
                    "propertyCustomCoords_" + p.property_id,
                    JSON.stringify(townCoords)
                  );
                } catch (e) {}
                break;
              }
            }
          }

          // If still no coords, trigger geocoding right away!
          if (!coords && (p.location || p.property_name)) {
            const query = p.location || p.property_name;
            geocodeAddress(query).then((geo) => {
              if (geo && geo.lat && geo.lng) {
                localStorage.setItem(
                  "propertyCustomCoords_" + p.property_id,
                  JSON.stringify([geo.lat, geo.lng])
                );
              }
            }).catch(() => {});
          }
        }

        return {
          id: p.property_id,
          name: p.property_name || `Property ${p.property_id}`,
          location: p.location,
          coordinates: coords || [10.7372, 122.4998],
          hasLots: propLots.length > 0,
        };
      });
    }
    return [
      { id: 1, name: "LOT-3896 Oton Cadastre", coordinates: [10.7372, 122.4998] },
      { id: 2, name: "Lot-2018 Oton Cadestra", coordinates: [10.737956, 122.505478] },
      { id: 3, name: "Lot-204 Nanga Guimbal", coordinates: [10.671313, 122.335284] },
    ];
  }, [mapData]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, {
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

        const finalMapData = { ...mapResponse.data, lots: lotsWithCustomerData };
        setMapData(finalMapData);
        try { sessionStorage.setItem("mapDataCache", JSON.stringify(finalMapData)); } catch (e) {}
      } catch (err) {
        console.error("Map Load Error:", err);
      }
    };

    fetchMapData();
  }, []);

  const prevPropertyRef = useRef(null);

  // Center map on selected property with smooth zoom out / glide flyTo animation on mount or property change
  useEffect(() => {
    if (!map || !selectedProperty || properties.length === 0) return;

    if (prevPropertyRef.current !== selectedProperty) {
      prevPropertyRef.current = selectedProperty;
      const target = properties.find((p) => p.id === selectedProperty);
      if (target && target.coordinates) {
        const timer = setTimeout(() => {
          map.flyTo(target.coordinates, 18, { duration: 1.5 });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedProperty, properties, map]);

  // Save selected property to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Show only lots from the selected property (not all at once — reduces lag when switching)
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots.filter((l) => l.property_id === selectedProperty);
  }, [mapData, selectedProperty]);

  // Get selected property coordinates
  const selectedPropertyCoords = useMemo(() => {
    const prop = properties.find((p) => p.id === selectedProperty);
    if (prop && prop.coordinates) return prop.coordinates;

    try {
      const custom = localStorage.getItem("propertyCustomCoords_" + selectedProperty);
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch (e) {}

    return [10.7372, 122.4998];
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

  const handleCloseOffcanvas = () => {
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  };

  // Function to refresh map data when lot is updated
  const handleLotUpdated = () => {
    const fetchMapData = async () => {
      try {
        const [mapResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lots/map-data`, { withCredentials: true }),
        ]);

        // Fetch customer details for all pending/sold lots
        const lotsWithCustomerData = await Promise.all(
          mapResponse.data.lots.map(async (lot) => {
            if ((lot.status === "Pending" || lot.status === "Sold") && !lot.customer) {
              try {
                const lotDetails = await axios.get(`${API_BASE_URL}/api/lots/${lot.lot_id}`, {
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

  if (!mapData) return <div className="p-5 text-gray-600 text-sm">Loading Estate Map...</div>;

  return (
    <div
      ref={mapWrapperRef}
      className="w-full h-full relative"
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={selectedPropertyCoords}
        zoom={19}
        maxZoom={21}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <MapLocationSearch />
        <MapLayerControls
          activeLayer={mapLayer}
          onLayerChange={(newLayer) => {
            setMapLayer(newLayer);
            localStorage.setItem("preferredMapLayer", newLayer);
          }}
          mapContainerRef={mapWrapperRef}
        />
        <MapController
          setSelectedProperty={setSelectedProperty}
          setMap={setMap}
        />
        <ActiveMapTileLayer activeLayer={mapLayer} />

        {filteredLots.map((lot) => {
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
            <React.Fragment key={`emp-lot-node-${lot.lot_id}-${lot.status}`}>
              <Polygon
                key={`emp-poly-${lot.lot_id}-${lot.status}`}
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
                key={`emp-line-${lot.lot_id}-${centerLat}-${centerLng}`}
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
                key={`emp-pin-${lot.lot_id}-${lot.status}-${centerLat.toFixed(6)}-${centerLng.toFixed(6)}`}
                position={[pinLat, centerLng]}
                icon={createPinIcon(lot.status)}
                eventHandlers={{
                  click: async (e) => {
                    e.originalEvent.stopPropagation();
                    // Prevent any property navigation when clicking on lots
                    e.originalEvent.preventDefault();

                    const matchingProp = properties.find(
                      (p) => Number(p.id) === Number(lot.property_id || selectedProperty)
                    );
                    const propName = matchingProp?.name || matchingProp?.property_name || "Golden Dragon Estate";
                    const propLocation = matchingProp?.location || matchingProp?.name || "Guimbal, Iloilo";

                    // Set basic lot data immediately with property details attached
                    setSelectedLot({
                      ...lot,
                      property_name: lot.property_name || propName,
                      location: lot.location || propLocation,
                    });
                    setIsOffcanvasOpen(true);

                    // Then fetch fresh data in background
                    try {
                      const lotDetails = await axios.get(
                        `${API_BASE_URL}/api/lots/${lot.lot_id}`,
                        {
                          withCredentials: true,
                        }
                      );
                      setSelectedLot({
                        ...lotDetails.data,
                        property_name: lotDetails.data.property_name || propName,
                        location: lotDetails.data.location || propLocation,
                      });
                    } catch (error) {
                      console.error("Error fetching customer data:", error);
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
      </MapContainer>

      {/* LotOffcanvas Component */}
      <LotOffcanvas
        isAdmin={false}
        selectedLot={selectedLot}
        propertyName={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.property_name ||
          "Golden Dragon Estate"
        }
        propertyLocation={
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.location ||
          properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
          selectedLot?.location ||
          "Guimbal, Iloilo"
        }
        isOpen={isOffcanvasOpen}
        onClose={handleCloseOffcanvas}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
      />
    </div>
  );
};

export default EmployeeMapView;
