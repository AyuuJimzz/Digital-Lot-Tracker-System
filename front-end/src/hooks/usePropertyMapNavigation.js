import { useEffect, useRef } from "react";
import { preloadLocationTiles, preloadFlightCorridorTiles } from "../utils/tilePreloader";
import { createPropertyFlight } from "../utils/propertyFlight";

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
    let target = null, targetZoom = 19, userMoved = false, moveTimer, flightToken = 0, navigationIntent = 0;
    let cancelPreload;
    const flight = createPropertyFlight(map, () => cancelFlight());
    const container = map.getContainer();
    const cancelFlight = () => {
      navigationIntent++;
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
      clearTimeout(moveTimer);
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
      const intent = ++navigationIntent;
      const startWhenCorridorReady = () => {
        if (intent !== navigationIntent) return;
        const warmup = flightWarmupRef.current;
        if (!warmup?.settled) {
          // A first cold-cache flight waits for the bounded high-priority corridor.
          // Property selection still updates immediately, and later clicks replace
          // an earlier destination while this one-time warmup is in progress.
          warmup.ready.finally(() => {
            if (flightWarmupRef.current !== warmup) startWhenCorridorReady();
            else if (intent === navigationIntent) startNavigate(coordinates, requestedZoom, flightOptions);
          });
          return;
        }
        startNavigate(coordinates, requestedZoom, flightOptions);
      };
      startWhenCorridorReady();
    };
    const onUserInterrupt = () => {
      if (!flyingMaps.has(map)) return;
      cancelFlight();
      map.stop();
    };
    const onNavigate = (event) => navigate(event.detail?.coordinates, event.detail?.zoom);
    const onSelect = (event) => {
      const { propertyId, coordinates, autoSwiped, straight } = event.detail || {};
      if (propertyId == null) return;
      latest.current.setSelectedProperty?.(propertyId);
      if (autoSwiped) return;
      const property = latest.current.properties?.find((item) => Number(item.id) === Number(propertyId));
      navigate(property?.coordinates || coordinates, 19, straight ? { straight: true } : {});
    };
    const onDragStart = () => {
      clearTimeout(moveTimer);
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
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        if (flyingMaps.has(map) || !userMoved) return;
        userMoved = false;
        const { properties = [], selectedProperty } = latest.current;
        let nearest = null, distance = 3500;
        properties.forEach((property) => {
          if (!property.coordinates) return;
          const candidateDistance = map.distance(map.getCenter(), property.coordinates);
          if (candidateDistance < distance) { nearest = property; distance = candidateDistance; }
        });
        if (!nearest || Number(nearest.id) === Number(selectedProperty)) return;
        localStorage.setItem("selectedProperty", String(nearest.id));
        window.dispatchEvent(new CustomEvent("selectProperty", {
          detail: { propertyId: nearest.id, autoSwiped: true },
        }));
      }, 120);
    };
    map.on("dragstart", onDragStart);
    map.on("moveend", onMoveEnd);
    container.addEventListener("wheel", onUserInterrupt, { passive: true });
    container.addEventListener("pointerdown", onUserInterrupt);
    container.addEventListener("keydown", onUserInterrupt);
    window.addEventListener("navigateToProperty", onNavigate);
    window.addEventListener("selectProperty", onSelect);
    return () => {
      clearTimeout(moveTimer);
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
