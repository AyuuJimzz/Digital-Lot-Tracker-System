import React, { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../../../../config/api";
import { showToast } from "../../../../components/GlobalToast";
import { getLotBounds } from "../../../../utils/lotViewport";
import { MAP_LAYERS } from "../../../../components/admin/MapLayerControls";
import { getPropertyFallbackCoordinates } from "../../../../utils/geocoding";
import { autoIncrementLotNumber, offsetPolygonAdjacent } from "../../../../utils/geoUtils";
import {
  getAuthConfig,
  STATUS_COLORS,
  isNonSaleableLot,
  getStatusColor
} from "../utils/mapConstants";
import { Marker } from "react-leaflet";
import { LotPlanPin, extractLotNumber } from "../../../../components/admin/LotPlanPin";
import { LotPlanPolygon } from "../../../../components/admin/LotPlanPolygon";
import { createOverviewPropertyIcon } from "../layers/OverviewBeaconsLayer";

import { useBlueprintOverlayState } from "./useBlueprintOverlayState";
import { useMapAnnotationsState } from "./useMapAnnotationsState";
import { useBulkShiftState } from "./useBulkShiftState";
import { useLotEditorState } from "./useLotEditorState";

export const useAdminViewMap = () => {
  const queryClient = useQueryClient();
  const mapQuery = useQuery({
    queryKey: ["map-data", "admin"],
    queryFn: async () => (await axios.get(`${API_BASE_URL}/api/lots/map-data`, getAuthConfig())).data,
    staleTime: 60 * 1000,
    structuralSharing: false,
  });
  const refetchMapData = mapQuery.refetch;
  const mapData = mapQuery.data ?? null;
  const setMapData = useCallback((update) => {
    queryClient.setQueryData(["map-data", "admin"], update);
  }, [queryClient]);
  const [map, setMap] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(19);
  const mapWrapperRef = useRef(null);
  const [mapLayer, setMapLayer] = useState(() => {
    return localStorage.getItem("preferredMapLayer") || MAP_LAYERS.SATELLITE;
  });
  const [selectedLot, setSelectedLot] = useState(null);
  const [activePopupLot, setActivePopupLot] = useState(null);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(() => {
    return localStorage.getItem("selectedProperty") || "1";
  });
  const [duplicateModalData, setDuplicateModalData] = useState(null);
  const activeLotFetchIdRef = useRef(null);
  const activeLotFetchAbortRef = useRef(null);

  // Clear active popup & close offcanvas on property change
  useEffect(() => {
    setActivePopupLot(null);
    setIsOffcanvasOpen(false);
    setSelectedLot(null);
  }, [selectedProperty]);

  const triggerArrivalPulse = useCallback((coords) => {
    window.dispatchEvent(
      new CustomEvent("triggerMapPulse", {
        detail: { coordinates: coords },
      })
    );
  }, []);

  // Handle updates when a lot is saved or updated
  const handleLotUpdated = useCallback(async () => {
    const result = await refetchMapData();
    if (result.error) console.error("Refresh map data error:", result.error);
  }, [refetchMapData]);

  // Live lot updates from editing modal
  const handleLiveLotUpdate = useCallback((updatedFields) => {
    if (!selectedLot) return;
    const updated = { ...selectedLot, ...updatedFields };
    setSelectedLot(updated);
    setMapData((prev) => {
      if (!prev || !prev.lots) return prev;
      return {
        ...prev,
        lots: prev.lots.map((l) =>
          Number(l.lot_id) === Number(updated.lot_id)
            ? { ...l, ...updatedFields }
            : l
        ),
      };
    });
  }, [selectedLot, setMapData]);

  // Refresh map data listener
  useEffect(() => {
    const handleRefreshMapData = () => handleLotUpdated();
    window.addEventListener("refreshMapData", handleRefreshMapData);
    return () => window.removeEventListener("refreshMapData", handleRefreshMapData);
  }, [handleLotUpdated]);

  // Property locations (dynamically derived from mapData or fallback)
  const properties = useMemo(() => {
    if (mapData && Array.isArray(mapData.properties) && mapData.properties.length > 0) {
      return mapData.properties.filter((p) => p.status !== "inactive").map((p) => {
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
              localStorage.setItem(
                "propertyCustomCoords_" + p.property_id,
                JSON.stringify(coords)
              );
            } catch (e) {}
          }
        } else {
          try {
            const saved = localStorage.getItem("propertyCustomCoords_" + p.property_id);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length >= 2) coords = parsed;
            }
          } catch (e) {}
        }

        const validCoords =
          coords && Array.isArray(coords) && coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])
            ? coords
            : [10.7372, 122.4998];

        return {
          id: p.property_id,
          name: p.property_name,
          location: p.location,
          coordinates: validCoords,
          lotCount: (mapData.lots || []).filter(
            (l) => Number(l.property_id) === Number(p.property_id)
          ).length,
        };
      });
    }
    return [];
  }, [mapData]);

  // Active property IDs set
  const activePropertyIds = useMemo(() => {
    return new Set(properties.map((p) => Number(p.id)));
  }, [properties]);

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
    } catch (e) {}

    return properties.length > 0 ? [10.7372, 122.4998] : [10.90, 122.60];
  }, [properties, selectedProperty]);

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

  // ── 1. Sub-Hook: Blueprint Image Overlay Engine ──
  const overlayState = useBlueprintOverlayState({
    map,
    selectedProperty,
  });

  // ── 2. Sub-Hook: Road Labels & Map Annotations ──
  const annotationsState = useMapAnnotationsState({
    map,
    selectedProperty,
    mapData,
    isEditingOverlay: overlayState.isEditingOverlay,
    setIsEditingOverlay: overlayState.setIsEditingOverlay,
    handleLotUpdated,
    automaticRoadAnnotations: overlayState.automaticRoadAnnotations,
  });

  // ── 3. Sub-Hook: Bulk Shift Engine ──
  const bulkShiftState = useBulkShiftState({
    selectedProperty,
    annotations: annotationsState.annotations,
    setAnnotations: annotationsState.setAnnotations,
    handleLotUpdated,
  });

  // ── 4. Sub-Hook: Lot Coordinate Editor & Snapping Engine ──
  const lotEditorState = useLotEditorState({
    map,
    mapData,
    selectedProperty,
    overlayRotation: overlayState.overlayRotation,
    properties,
    selectedPropertyCoords,
    handleLotUpdated,
    setSelectedProperty,
  });

  // Handle duplicating / cloning a lot with auto-incremented identifier & adjacent offset
  const handleDuplicateLot = (lotToDuplicate) => {
    const sourceLot =
      lotToDuplicate ||
      (lotEditorState.editingLot
        ? {
            lot_id: lotEditorState.editingLot.lot_id,
            lot_number: lotEditorState.editingLot.lot_number,
            property_id: lotEditorState.editingLot.property_id,
            area_sqm: lotEditorState.targetAreaSqm || lotEditorState.editingLot.area_sqm || 100,
            coordinates: lotEditorState.editingCoords.length >= 3 ? lotEditorState.editingCoords : null,
          }
        : selectedLot);

    if (!sourceLot) {
      showToast("Please select a lot to duplicate.", "warning");
      return;
    }

    const propId = sourceLot.property_id || selectedProperty;
    const nextLotNumber = autoIncrementLotNumber(sourceLot.lot_number || "Lot 1");
    const targetArea = sourceLot.area_sqm || 100;

    setDuplicateModalData({
      sourceLot,
      propId,
      targetArea,
      lotName: nextLotNumber,
      isSubmitting: false,
    });
  };

  const handleConfirmDuplicateLot = async () => {
    if (!duplicateModalData || duplicateModalData.isSubmitting) return;
    const { sourceLot, propId, targetArea, lotName } = duplicateModalData;
    const finalLotName = (lotName || "").trim();
    if (!finalLotName) {
      showToast("Please enter an identifier for the new lot.", "warning");
      return;
    }

    setDuplicateModalData((prev) => ({ ...prev, isSubmitting: true }));

    try {
      let rawCoords = null;
      if (lotEditorState.editingCoords && Array.isArray(lotEditorState.editingCoords) && lotEditorState.editingCoords.length >= 3) {
        rawCoords = lotEditorState.editingCoords;
      } else if (sourceLot.coordinates) {
        if (typeof sourceLot.coordinates === "string") {
          try {
            rawCoords = JSON.parse(sourceLot.coordinates);
          } catch (e) {}
        } else if (Array.isArray(sourceLot.coordinates)) {
          rawCoords = sourceLot.coordinates;
        }
      }

      if (!rawCoords || rawCoords.length < 3) {
        const foundInMap = mapData?.lots?.find(
          (l) => Number(l.lot_id) === Number(sourceLot.lot_id)
        );
        if (foundInMap && foundInMap.coordinates) {
          rawCoords =
            typeof foundInMap.coordinates === "string"
              ? JSON.parse(foundInMap.coordinates)
              : foundInMap.coordinates;
        }
      }

      if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length < 3) {
        const currentCenter = map ? map.getCenter() : null;
        const baseCoords = currentCenter ? [currentCenter.lat, currentCenter.lng] : selectedPropertyCoords;
        const offset = 0.00015;
        rawCoords = [
          [baseCoords[0] - offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] - offset],
          [baseCoords[0] + offset, baseCoords[1] + offset],
          [baseCoords[0] - offset, baseCoords[1] + offset],
        ];
      }

      const newCoords = offsetPolygonAdjacent(rawCoords);

      const createRes = await axios.post(
        `${API_BASE_URL}/api/lots`,
        {
          property_id: parseInt(propId),
          lot_number: finalLotName,
          area_sqm: parseFloat(targetArea) || 100,
          status: "Available",
        },
        getAuthConfig()
      );

      const newLotId = createRes.data.lot_id;

      if (newCoords && Array.isArray(newCoords) && newCoords.length >= 3) {
        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: newCoords },
          getAuthConfig()
        );
      }

      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      await handleLotUpdated();

      setIsOffcanvasOpen(false);
      setDuplicateModalData(null);
      lotEditorState.setEditingLot({
        lot_id: newLotId,
        lot_number: finalLotName,
        property_id: parseInt(propId),
        area_sqm: parseFloat(targetArea) || 100,
      });
      lotEditorState.setEditingCoords(newCoords.map((c) => [...c]));

      window.dispatchEvent(
        new CustomEvent("startVisualEdit", {
          detail: {
            lot_id: newLotId,
            lot_number: finalLotName,
            property_id: parseInt(propId),
            area_sqm: parseFloat(targetArea) || 100,
            coordinates: newCoords,
          },
        })
      );

      showToast(`Successfully created ${finalLotName}! You can now adjust its corners.`, "success");
    } catch (err) {
      console.error("Error duplicating lot:", err);
      showToast(err.response?.data?.error || err.message || "Failed to duplicate lot", "error");
      setDuplicateModalData((prev) => (prev ? { ...prev, isSubmitting: false } : null));
    }
  };

  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      ("ontouchstart" in window && window.innerWidth < 1100));

  const lotDetailsContext = useRef({ properties, selectedProperty });
  useLayoutEffect(() => {
    lotDetailsContext.current = { properties, selectedProperty };
  }, [properties, selectedProperty]);

  const showLotTooltips = currentZoom >= 17.5;
  const shiftedPropertyId = bulkShiftState.isBulkShifting ? selectedProperty : null;

  const renderLot = useCallback((lot, showHover, hideHover, renderer) => {
    if (lotEditorState.editingLot && Number(lot.lot_id) === Number(lotEditorState.editingLot.lot_id)) {
      return null;
    }

    if (!lot.coordinates || !Array.isArray(lot.coordinates) || lot.coordinates.length === 0) {
      console.warn(
        `Lot ${lot.lot_id} (${lot.lot_number}) has invalid coordinates, skipping...`
      );
      return null;
    }

    const coords =
      bulkShiftState.isBulkShifting && Number(lot.property_id) === Number(shiftedPropertyId)
        ? lot.coordinates.map(([lat, lng]) => [
            lat + bulkShiftState.bulkShiftOffset.lat,
            lng + bulkShiftState.bulkShiftOffset.lng,
          ])
        : lot.coordinates;

    const isShifted = bulkShiftState.isBulkShifting && Number(lot.property_id) === Number(shiftedPropertyId);
    const centerLat = isShifted ? (lot._centerLat ?? 0) + bulkShiftState.bulkShiftOffset.lat : (lot._centerLat ?? 0);
    const centerLng = isShifted ? (lot._centerLng ?? 0) + bulkShiftState.bulkShiftOffset.lng : (lot._centerLng ?? 0);
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
        // Stale-response guard: ignore response if user rapidly switched to another lot
        if (activeLotFetchIdRef.current !== targetLotId) {
          return;
        }
        setSelectedLot({
          ...lotDetails.data,
          property_name: lotDetails.data.property_name || propName,
          location: lotDetails.data.location || propLocation,
        });
      } catch (err) {
        if (axios.isCancel(err) || err.name === "AbortError" || activeLotFetchIdRef.current !== targetLotId) {
          return;
        }
        console.error("Lot Details Error:", err);
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
      <React.Fragment key={`lot-node-${lot.lot_id}`}>
        <LotPlanPolygon
          key={`poly-${lot.lot_id}`}
          renderer={renderer}
          positions={coords}
          pathOptions={{
            color: bulkShiftState.isBulkShifting ? "#3b82f6" : statusColor,
            fillColor: bulkShiftState.isBulkShifting ? "#3b82f6" : statusColor,
            fillOpacity: bulkShiftState.isBulkShifting ? 0.65 : 0.6,
            weight: bulkShiftState.isBulkShifting ? 2.5 : 2,
            dashArray: bulkShiftState.isBulkShifting ? "4, 4" : undefined,
            className: bulkShiftState.isBulkShifting ? "cursor-grab active:cursor-grabbing" : undefined,
          }}
          eventHandlers={{
            mousedown: (e) => {
              if (bulkShiftState.isBulkShifting && map) {
                if (e?.originalEvent) {
                  e.originalEvent.stopPropagation();
                  e.originalEvent.preventDefault();
                }
                map.dragging.disable();
                const startPoint = e.latlng;
                const initOffset = { ...bulkShiftState.bulkShiftOffset };

                const handleMove = (moveEvent) => {
                  const dLat = moveEvent.latlng.lat - startPoint.lat;
                  const dLng = moveEvent.latlng.lng - startPoint.lng;
                  bulkShiftState.setBulkShiftOffset({
                    lat: initOffset.lat + dLat,
                    lng: initOffset.lng + dLng,
                  });
                };

                const handleUp = () => {
                  map.dragging.enable();
                  map.off("mousemove", handleMove);
                  map.off("mouseup", handleUp);
                };

                map.on("mousemove", handleMove);
                map.on("mouseup", handleUp);
              }
            },
            click: (e) => {
              if (bulkShiftState.isBulkShifting) return;
              handleLotClick(e);
            },
            mouseover: () => showHover(lot, [centerLat, centerLng]),
            mouseout: () => hideHover(lot),
          }}
        />

        {!bulkShiftState.isBulkShifting && (
          <LotPlanPin
            key={`pin-${lot.lot_id}`}
            center={[centerLat, centerLng]}
            color={statusColor}
            text={extractLotNumber(lot.lot_number)}
            eventHandlers={{
              click: handleLotClick,
              mouseover: () => showHover(lot, [centerLat, centerLng]),
              mouseout: () => hideHover(lot),
            }}
          />
        )}
      </React.Fragment>
    );

  }, [
    isTouchDevice,
    lotEditorState.editingLot,
    bulkShiftState,
    shiftedPropertyId,
    map,
  ]);

  const overviewBeacons = useMemo(() => properties.map((property) => {
    if (!property.coordinates || !Array.isArray(property.coordinates) || property.coordinates.length < 2) return null;
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
                detail: { propertyId: property.id, coordinates: property.coordinates },
              })
            );
          },
        }}
      />
    );
  }), [properties]);

  return {
    // Master Core Map State
    mapData,
    mapError: mapQuery.error,
    retryMapData: refetchMapData,
    setMapData,
    map,
    setMap,
    currentZoom,
    setCurrentZoom,
    mapWrapperRef,
    mapLayer,
    setMapLayer,
    selectedLot,
    setSelectedLot,
    activePopupLot,
    setActivePopupLot,
    isOffcanvasOpen,
    setIsOffcanvasOpen,
    selectedProperty,
    setSelectedProperty,
    triggerArrivalPulse,
    duplicateModalData,
    setDuplicateModalData,
    handleDuplicateLot,
    handleConfirmDuplicateLot,
    properties,
    activePropertyIds,
    filteredLots,
    selectedPropertyCoords,
    handleLotUpdated,
    handleLiveLotUpdate,
    isTouchDevice,
    lotDetailsContext,
    showLotTooltips,
    shiftedPropertyId,
    renderLot,
    overviewBeacons,
    getAuthConfig,
    STATUS_COLORS,
    isNonSaleableLot,
    getStatusColor,

    // Sub-Hook 1: Blueprint Overlay State & Operations
    ...overlayState,

    // Sub-Hook 2: Map Annotations & Road Labels
    ...annotationsState,

    // Sub-Hook 3: Bulk Shift State & Operations
    ...bulkShiftState,

    // Sub-Hook 4: Visual Lot Editor & Snapping Magnet Engine
    ...lotEditorState,
  };
};

export default useAdminViewMap;
