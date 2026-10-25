import { useEffect, useRef } from "react";
import { preloadLocationTiles, preloadFlightCorridorTiles } from "../utils/tilePreloader";
import { createPropertyFlight } from "../utils/propertyFlight";
import { loadPropertyMapView, savePropertyMapView } from "../utils/propertyMapView";

const flyingMaps = new WeakSet();

// Defer large PDF canvas work until the camera has arrived.
export function waitForPropertyFlight(map) {
  if (!map || !flyingMaps.has(map)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      map.off("propertyflightend unload", finish);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => waitForPropertyFlight(map).then(resolve));
      });
    };
    map.on("propertyflightend unload", finish);
  });
}

export function usePropertyMapNavigation(map, options) {
  const latest = useRef(options);
  latest.current = options;
  const flightWarmupRef = useRef({ settled: true, ready: Promise.resolve(true) });
  const propertyWarmupKey = (options?.properties || [])
    .map((property) => Array.isArray(property?.coordinates) ? property.coordinates.join(",") : "")
    .join("|");

  // Start with the two or three z8 parent tiles, then fill the z12/z13 corridor.
  // Re-run when async property data arrives; the old implementation only ran
  // once with an empty property list on a cold application start.
  useEffect(() => {
    if (!map) return;
    const warmup = preloadFlightCorridorTiles(latest.current?.properties, latest.current?.mapLayer || "satellite");
    const state = { settled: false, ready: warmup.ready };
    flightWarmupRef.current = state;
    warmup.ready.finally(() => { state.settled = true; });
    return () => warmup?.();
  }, [map, options?.mapLayer, propertyWarmupKey]);

  useEffect(() => {
    if (!map) return;
    let target = null, targetZoom = 19, userMoved = false, flightToken = 0;
    let cancelPreload;
    const flight = createPropertyFlight(map, () => cancelFlight());
    const container = map.getContainer();
    const rememberEmptyPropertyView = () => {
      if (flyingMaps.has(map)) return; // Never record in-flight position
      const { properties = [], selectedProperty } = latest.current;
      const property = properties.find((item) => Number(item.id) === Number(selectedProperty));
      // Only remember view if camera is actually settled within 800m of this property
      if (property && property.lotCount === 0 && property.coordinates) {
        const center = map.getCenter();
        if (map.distance(center, property.coordinates) < 800) {
          savePropertyMapView(selectedProperty, map);
        }
      }
    };
    const cancelFlight = () => {
      const wasFlying = flyingMaps.has(map);
      cancelPreload?.();
      flightToken++;
      flyingMaps.delete(map);
      container.classList.remove("map-is-flying", "map-flight-near-target");
      target = null;
      targetZoom = 19;
      flight.cancel();
      if (wasFlying) map.fire("propertyflightend");
      if (wasFlying) latest.current.onFlightEnd?.();
    };
    const finishFlight = (token = null) => {
      if (token != null && token !== flightToken) return;
      flyingMaps.delete(map);
      container.classList.remove("map-is-flying", "map-flight-near-target");
      target = null;
      targetZoom = 19;
      cancelPreload?.();
      rememberEmptyPropertyView();
      map.fire("propertyflightend");
      latest.current.onFlightEnd?.();
    };
    const startNavigate = (coordinates, requestedZoom = 19, flightOptions = {}) => {
      if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[1]) > 180) return;
      const minZoom = map.getMinZoom?.() ?? 7;
      const maxZoom = map.getMaxZoom?.() ?? 28;
      const destinationZoom = Math.max(minZoom, Math.min(maxZoom, Number.isFinite(requestedZoom) ? requestedZoom : 19));
      if (target && map.distance(target, coordinates) < 1 && Math.abs(targetZoom - destinationZoom) < 0.05) return;
      if (!target && map.distance(map.getCenter(), coordinates) < 1 && Math.abs(map.getZoom() - destinationZoom) < 0.05) return;
      userMoved = false;
      target = coordinates;
      targetZoom = destinationZoom;
      flightToken++;
      cancelPreload?.();
      const distanceKm = map.distance(map.getCenter(), coordinates) / 1000;
      // Match the reference's short, responsive flight; allow a little more
      // time for long travel or a large overview-to-lot zoom to settle.
      const distanceDuration = 1.2 + Math.log2(1 + distanceKm) * 0.08;
      const zoomDuration = 1.2 + Math.abs(destinationZoom - map.getZoom()) * 0.06;
      let duration;
      if (distanceKm > 60) {
        // Inter-province / Island-wide journey (e.g. Iloilo -> Boracay ~180km)
        duration = Math.min(3.8, 3.2 + Math.log2(distanceKm / 60) * 0.35);
      } else if (distanceKm > 5) {
        // Inter-town journey (e.g. Guimbal -> Oton ~10-15km)
        duration = Math.min(2.8, 2.0 + Math.log2(distanceKm / 5) * 0.22);
      } else {
        // Local neighborhood / estate hop (<5km)
        const localDuration = Math.max(distanceDuration, zoomDuration);
        duration = Math.min(1.8, Math.max(1.4, localDuration));
      }
      if (flightOptions.straight) {
        duration = Math.min(duration, 1.4);
      }
      const wasFlying = flyingMaps.has(map);
      // Finish wheel motion before marking this flight active: its moveend must
      // not accidentally finish a newly requested flight at the same location.
      if (!wasFlying) map.fire("propertyflightstart");
      flyingMaps.add(map);
      container.classList.add("map-is-flying");
      if (!wasFlying) latest.current.onFlightStart?.();
      const destinationLayer = latest.current.mapLayer || "satellite";
      // Preload focused zoom levels on arrival without congesting network bandwidth.
      const preloadZooms = distanceKm > 0.5
        ? [...new Set([Math.max(1, Math.floor(destinationZoom) - 2), Math.max(1, Math.floor(destinationZoom) - 1), Math.max(1, Math.floor(destinationZoom))])]
        : [...new Set([Math.max(1, Math.floor(destinationZoom) - 1), Math.max(1, Math.floor(destinationZoom))])];
      const preloadRadius = distanceKm > 1 ? 2 : 1;
      cancelPreload = preloadLocationTiles(coordinates[0], coordinates[1], preloadZooms, destinationLayer, preloadRadius);
      flight.navigate(coordinates, destinationZoom, { duration, animate: true, ...flightOptions });
      latest.current.triggerArrivalPulse?.(coordinates);
    };
    const navigate = (coordinates, requestedZoom = 19, flightOptions = {}) => {
      latest.current.onNavigationIntent?.();
      // Immediate, responsive flight takeoff without blocking on network warmup promises.
      // Corridor tiles stream concurrently in the background while the camera is in motion.
      startNavigate(coordinates, requestedZoom, flightOptions);
    };
    const onUserInterrupt = () => {
      if (!flyingMaps.has(map)) return;
      cancelFlight();
      map.stop();
    };
    const onNavigate = (event) => navigate(event.detail?.coordinates, event.detail?.zoom);
    const onSelect = (event) => {
      const { propertyId, coordinates, autoSwiped, fromBeaconClick, straight } = event.detail || {};
      if (propertyId == null) return;
      latest.current.setSelectedProperty?.(propertyId);
      if (autoSwiped) return;
      const property = latest.current.properties?.find((item) => Number(item.id) === Number(propertyId));
      const propCoords = property?.coordinates || coordinates;

      // Only fly straight when explicitly triggered by clicking an overview beacon pin.
      // Switching properties via header dropdown or rapid retargeting must ALWAYS bounce (parabolic arc).
      const isBeaconClickFromOverview = Boolean(fromBeaconClick && map.getZoom() < 18);
      const useStraight = Boolean(isBeaconClickFromOverview || (fromBeaconClick && straight));

      // For empty properties (0 lots), ALWAYS navigate dead-center directly to the yellow beacon pin!
      if (property?.lotCount === 0 && propCoords) {
        const savedView = loadPropertyMapView(propertyId);
        const isValidSavedView =
          savedView?.center &&
          Array.isArray(savedView.center) &&
          map.distance(savedView.center, propCoords) < 800;
        const targetCenter = isValidSavedView ? savedView.center : propCoords;
        const targetZoom = isValidSavedView ? savedView.zoom : 19;
        navigate(targetCenter, targetZoom, useStraight ? { straight: true } : {});
        return;
      }

      // For properties with mapped lots, calculate ideal framing zoom so all blocks fit comfortably
      let idealBoundsZoom = 17.8;
      let idealBoundsCenter = propCoords;
      if (property?.bounds && map) {
        const { south, north, west, east } = property.bounds;
        idealBoundsCenter = [(south + north) / 2, (west + east) / 2];
        try {
          const fitZ = map.getBoundsZoom(
            [[south, west], [north, east]],
            false,
            [50, 50]
          );
          if (Number.isFinite(fitZ)) {
            // Keep zoom within comfortable reading range (16.5 to 18.2)
            idealBoundsZoom = Math.min(18.2, Math.max(16.5, fitZ));
          }
        } catch (_) {}
      }

      navigate(idealBoundsCenter, idealBoundsZoom, useStraight ? { straight: true } : {});
    };
    const onDragStart = () => {
      cancelFlight();
      userMoved = true;
    };
    const onMoveEnd = () => {
      if (flyingMaps.has(map)) {
        if (target && (map.distance(map.getCenter(), target) > 10 || Math.abs(map.getZoom() - targetZoom) > 0.1)) return;
        finishFlight(flightToken);
        return;
      }
      if (!userMoved) return;
      userMoved = false;
      rememberEmptyPropertyView();

      // Viewport Auto-Sync: Automatically sync the active property and header dropdown
      // to whichever subdivision the user has slid/panned over
      const { properties = [], selectedProperty } = latest.current;
      if (properties.length > 0) {
        const center = map.getCenter();
        const zoom = map.getZoom();

        // If the user is currently viewing an empty property, don't auto-switch away
        // if they are still panning around within its local area (< 1000m)
        const currentProp = properties.find((item) => Number(item.id) === Number(selectedProperty));
        if (
          currentProp &&
          currentProp.lotCount === 0 &&
          currentProp.coordinates &&
          map.distance(center, currentProp.coordinates) < 1000
        ) {
          return;
        }

        let closestProperty = null;
        let minDistance = Infinity;

        for (const prop of properties) {
          if (!prop.coordinates || !Array.isArray(prop.coordinates)) continue;

          // 1. Direct hit inside lot bounds if available
          if (prop.bounds) {
            const { south, north, west, east } = prop.bounds;
            const padLat = 0.0006;
            const padLng = 0.0006;
            if (
              center.lat >= south - padLat &&
              center.lat <= north + padLat &&
              center.lng >= west - padLng &&
              center.lng <= east + padLng
            ) {
              closestProperty = prop;
              minDistance = 0;
              break;
            }
          }

          // 2. Proximity to property center
          const dist = map.distance(center, prop.coordinates);
          if (dist < minDistance) {
            minDistance = dist;
            closestProperty = prop;
          }
        }

        // Adaptive proximity threshold: allows smooth sliding across subdivisions
        const maxThreshold = Math.max(650, Math.min(2500, Math.pow(2, 19 - zoom) * 650));

        if (
          closestProperty &&
          Number(closestProperty.id) !== Number(selectedProperty) &&
          minDistance <= maxThreshold
        ) {
          const newPropId = closestProperty.id.toString();
          latest.current.setSelectedProperty?.(newPropId);
          localStorage.setItem("selectedProperty", newPropId);
          window.dispatchEvent(
            new CustomEvent("selectProperty", {
              detail: {
                propertyId: closestProperty.id,
                coordinates: closestProperty.coordinates,
                autoSwiped: true, // Prevents abrupt camera re-centering/jump
              },
            })
          );
        }
      }
    };
    map.on("dragstart", onDragStart);
    map.on("moveend", onMoveEnd);
    container.addEventListener("wheel", onUserInterrupt, { passive: true });
    container.addEventListener("pointerdown", onUserInterrupt);
    container.addEventListener("keydown", onUserInterrupt);
    window.addEventListener("navigateToProperty", onNavigate);
    window.addEventListener("selectProperty", onSelect);
    return () => {
      cancelFlight();
      flight.dispose();
      map.off("dragstart", onDragStart);
      map.off("moveend", onMoveEnd);
      container.removeEventListener("wheel", onUserInterrupt);
      container.removeEventListener("pointerdown", onUserInterrupt);
      container.removeEventListener("keydown", onUserInterrupt);
      window.removeEventListener("navigateToProperty", onNavigate);
      window.removeEventListener("selectProperty", onSelect);
    };
  }, [map]);
}
