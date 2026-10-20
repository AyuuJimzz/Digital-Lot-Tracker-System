import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { API_BASE_URL } from "../../../config/api";
import { getLotBounds } from "../../../utils/lotViewport";
import { LotPlanPolygon } from "../../../components/admin/LotPlanPolygon";
import { LotPlanPin, extractLotNumber } from "../../../components/admin/LotPlanPin";
import { MAP_LAYERS } from "../../../components/admin/MapLayerControls";
import { getPropertyFallbackCoordinates } from "../../../utils/geocoding";
import {
  getAuthConfig,
  isNonSaleableLot,
  getStatusColor,
} from "../../Admin/map/utils/mapConstants";

export function useEmployeeMapView() {
  const mapQuery = useQuery({
    queryKey: ["map-data", "employee"],
    queryFn: async () => (await axios.get(`${API_BASE_URL}/api/lots/map-data`, getAuthConfig())).data,
    staleTime: 60 * 1000,
    structuralSharing: false,
  });
  const refetchMapData = mapQuery.refetch;
  const mapData = mapQuery.data ?? null;

  const [selectedLot, setSelectedLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(19);
  const mapWrapperRef = useRef(null);
  const activeLotFetchIdRef = useRef(null);
  const activeLotFetchAbortRef = useRef(null);

  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem("preferredMapLayer") || MAP_LAYERS.SATELLITE;
  });

  const [activePopupLot, setActivePopupLot] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    const savedProperty = localStorage.getItem("selectedProperty");
    return savedProperty ? parseInt(savedProperty, 10) : 1;
  });

  // Clear active popup & close offcanvas on property change
  useEffect(() => {
    setActivePopupLot(null);
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  }, [selectedProperty]);

  const triggerArrivalPulse = useCallback(() => {
    // Arrival pulse handled smoothly by MapController
  }, []);

  // Save selected property to localStorage
  useEffect(() => {
    localStorage.setItem("selectedProperty", selectedProperty.toString());
  }, [selectedProperty]);

  // Save preferred map layer to localStorage
  const handleLayerChange = useCallback((newLayer) => {
    setMapLayer(newLayer);
    localStorage.setItem("preferredMapLayer", newLayer);
  }, []);

  // Refresh map data when lot is updated
  const handleLotUpdated = useCallback(() => {
    return refetchMapData();
  }, [refetchMapData]);

  // Active property locations - derived from mapData or fallback
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties
        .filter((p) => p.status !== "inactive")
        .map((p) => {
          let coords = getPropertyFallbackCoordinates(p.property_id, p.location, p.property_name);
          const propLots = (mapData.lots || []).filter(
            (l) => Number(l.property_id) === Number(p.property_id) && l.coordinates && l.coordinates.length > 0
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
                localStorage.setItem("propertyCustomCoords_" + p.property_id, JSON.stringify(coords));
              } catch (_) {}
            }
          } else {
            try {
              const cachedCoords = localStorage.getItem("propertyCustomCoords_" + p.property_id);
              if (cachedCoords) {
                coords = JSON.parse(cachedCoords);
              }
            } catch (_) {}

          }

          return {
            id: p.property_id,
            name: p.property_name || `Property ${p.property_id}`,
            location: p.location,
            coordinates: coords || [10.7372, 122.4998],
            hasLots: propLots.length > 0,
            lotCount: (mapData.lots || []).filter(
              (lot) => Number(lot.property_id) === Number(p.property_id)
            ).length,
            status: p.status || "active",
          };
        });
    }
    return [];
  }, [mapData]);

  // Fallback if selected property becomes inactive
  useEffect(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      const exists = mapData.properties.some(
        (p) => p.status !== "inactive" && Number(p.property_id) === Number(selectedProperty)
      );
      if (!exists) {
        const fallbackProp = properties[0];
        if (fallbackProp) {
          setSelectedProperty(fallbackProp.id);
          localStorage.setItem("selectedProperty", fallbackProp.id.toString());
          if (fallbackProp.coordinates) {
            window.dispatchEvent(
              new CustomEvent("selectProperty", {
                detail: { propertyId: fallbackProp.id, coordinates: fallbackProp.coordinates },
              })
            );
          }
        }
      }
    }
  }, [mapData, properties, selectedProperty]);

  // Active property IDs set to exclude lots from inactive properties
  const activePropertyIds = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.properties)) return new Set([1, 2, 3]);
    return new Set(
      mapData.properties
        .filter((p) => p.status !== "inactive")
        .map((p) => Number(p.property_id))
    );
  }, [mapData]);

  // Road & Map Text Annotations across all active properties
  const allPropertyAnnotations = useMemo(() => {
    if (!mapData?.properties) return [];
    const result = [];
    mapData.properties.forEach((p) => {
      if (!p.annotations) return;
      try {
        const parsed =
          typeof p.annotations === "string" ? JSON.parse(p.annotations) : p.annotations;
        if (Array.isArray(parsed)) {
          result.push(
            ...parsed
              .filter((item) => !item.deleted)
              .map((item) => ({ ...item, property_id: p.property_id }))
          );
        }
      } catch (_) {}
    });
    return result;
  }, [mapData]);

  const createRoadLabelIcon = useCallback((item) => {
    return L.divIcon({
      className: "map-road-label-icon",
      html: `
        <div class="map-road-label-inner" style="
          position: absolute;
          left: 0;
          top: 0;
          transform: translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(var(--pdf-road-label-scale, 1));
          transform-origin: center center;
          color: ${item.color || '#e2e8f0'};
          font-size: ${item.fontSize || 12}px;
          font-weight: 800;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: 0;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1);
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        ">
          <span>${String(item.text || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // Cache each polygon's bounds once per data refresh for cheap viewport filtering
  const filteredLots = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.lots)) return [];
    return mapData.lots
      .filter((lot) => activePropertyIds.has(Number(lot.property_id)))
      .map((lot) => {
        const bounds = getLotBounds(lot.coordinates);
        if (!bounds) return lot;
        return {
          ...lot,
          _bounds: bounds,
          _statusColor: getStatusColor(lot.status, lot, lot.area_sqm),
          _nonSaleable: isNonSaleableLot(lot, lot.area_sqm),
          _centerLat: (bounds.south + bounds.north) / 2,
          _centerLng: (bounds.west + bounds.east) / 2,
        };
      });
  }, [mapData, activePropertyIds]);

  // Selected property coordinates
  const selectedPropertyCoords = useMemo(() => {
    const prop = properties.find((p) => Number(p.id) === Number(selectedProperty));
    if (prop && prop.coordinates) return prop.coordinates;

    try {
      const custom = localStorage.getItem("propertyCustomCoords_" + selectedProperty);
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch (_) {}

    return [10.7372, 122.4998];
  }, [properties, selectedProperty]);

  const handleCloseOffcanvas = useCallback(() => {
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  }, []);

  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      ("ontouchstart" in window && window.innerWidth < 1100));

  const lotDetailsContext = useRef({ properties, selectedProperty });
  useLayoutEffect(() => {
    lotDetailsContext.current = { properties, selectedProperty };
  }, [properties, selectedProperty]);

  const showLotTooltips = currentZoom >= 17.5;

  const renderLot = useCallback(
    (lot, showHover, hideHover, renderer) => {
      if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
        return null;
      }

      const centerLat = lot._centerLat ?? 0;
      const centerLng = lot._centerLng ?? 0;
      const statusColor = lot._statusColor;

      const openFullLotDetails = async () => {
        const targetLotId = lot.lot_id ?? lot.id;
        activeLotFetchIdRef.current = targetLotId;

        if (activeLotFetchAbortRef.current) {
          activeLotFetchAbortRef.current.abort();
        }
        const controller = new AbortController();
        activeLotFetchAbortRef.current = controller;

        const matchingProp = lotDetailsContext.current.properties.find(
          (p) => Number(p.id) === Number(lot.property_id || lotDetailsContext.current.selectedProperty)
        );
        const propName = matchingProp?.name || matchingProp?.property_name || "Golden Dragon Estate";
        const propLocation = matchingProp?.location || matchingProp?.name || "Guimbal, Iloilo";

        setSelectedLot({
          ...lot,
          property_name: lot.property_name || propName,
          location: lot.location || propLocation,
        });
        setIsOffcanvasOpen(true);

        try {
          const lotDetails = await axios.get(
            `${API_BASE_URL}/api/lots/${targetLotId}`,
            {
              ...getAuthConfig(),
              signal: controller.signal,
            }
          );
          if (activeLotFetchIdRef.current !== targetLotId) {
            return;
          }
          setSelectedLot({
            ...lotDetails.data,
            property_name: lotDetails.data.property_name || propName,
            location: lotDetails.data.location || propLocation,
          });
        } catch (error) {
          if (axios.isCancel(error) || error.name === "AbortError" || activeLotFetchIdRef.current !== targetLotId) {
            return;
          }
          console.error("Error fetching full lot details:", error);
        }
      };

      const handleLotClick = (e) => {
        if (e?.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
        if (!isTouchDevice) {
          openFullLotDetails();
        } else {
          setActivePopupLot({
            ...lot,
            position: [centerLat, centerLng],
            statusColor,
          });
        }
      };

      return (
        <React.Fragment key={`emp-lot-node-${lot.lot_id}`}>
          <LotPlanPolygon
            key={`emp-poly-${lot.lot_id}`}
            renderer={renderer}
            positions={lot.coordinates}
            pathOptions={{
              color: statusColor,
              fillColor: statusColor,
              fillOpacity: 0.6,
              weight: 2,
            }}
            eventHandlers={{
              click: handleLotClick,
              mouseover: () => showHover(lot, [centerLat, centerLng]),
              mouseout: () => hideHover(lot),
            }}
          />

          <LotPlanPin
            key={`emp-pin-${lot.lot_id}`}
            center={[centerLat, centerLng]}
            color={statusColor}
            text={extractLotNumber(lot.lot_number)}
            eventHandlers={{
              click: handleLotClick,
              mouseover: () => showHover(lot, [centerLat, centerLng]),
              mouseout: () => hideHover(lot),
            }}
          />
        </React.Fragment>
      );
    },
    [isTouchDevice]
  );

  return {
    mapData,
    mapError: mapQuery.error,
    retryMapData: refetchMapData,
    properties,
    selectedProperty,
    setSelectedProperty,
    selectedPropertyCoords,
    mapLayer,
    setMapLayer: handleLayerChange,
    currentZoom,
    setCurrentZoom,
    mapWrapperRef,
    triggerArrivalPulse,
    activePopupLot,
    setActivePopupLot,
    selectedLot,
    setSelectedLot,
    isOffcanvasOpen,
    setIsOffcanvasOpen,
    handleCloseOffcanvas,
    handleLotUpdated,
    filteredLots,
    showLotTooltips,
    isTouchDevice,
    renderLot,
    allPropertyAnnotations,
    createRoadLabelIcon,
  };
}
