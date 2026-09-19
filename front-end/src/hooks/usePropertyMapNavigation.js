import { useEffect, useRef } from "react";

const flyingMaps = new WeakSet();

// Defer large PDF canvas work until the camera has arrived.
export function waitForPropertyFlight(map) {
  if (!map || !flyingMaps.has(map)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      map.off("moveend unload", finish);
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    };
    map.on("moveend unload", finish);
  });
}

export function usePropertyMapNavigation(map, options) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    if (!map) return;
    let target = null, userMoved = false, moveTimer, flightToken = 0;
    const container = map.getContainer();
    const cancelFlight = () => {
      flightToken++;
      flyingMaps.delete(map);
      container.classList.remove("map-is-flying");
      target = null;
    };
    const finishFlight = (token = null) => {
      if (token != null && token !== flightToken) return;
      flyingMaps.delete(map);
      container.classList.remove("map-is-flying");
      target = null;
    };
    const navigate = (coordinates) => {
      if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[1]) > 180) return;
      if (target && map.distance(target, coordinates) < 1) return;
      if (!target && map.distance(map.getCenter(), coordinates) < 1 && map.getZoom() === 19) return;
      clearTimeout(moveTimer);
      userMoved = false;
      target = coordinates;
      flightToken++;
      const distanceKm = map.distance(map.getCenter(), coordinates) / 1000;
      const duration = Math.min(4.2, Math.max(1.4, 1.38 + Math.log2(1 + distanceKm) * 0.55));
      flyingMaps.add(map);
      container.classList.add("map-is-flying");
      // flyTo cancels an old flight without rounding its intermediate zoom.
      // Calling stop()/setView() first introduces a visible snap on retargeting.
      map.flyTo(coordinates, 19, {
        duration, easeLinearity: 0.25, animate: true,
      });
      latest.current.triggerArrivalPulse?.(coordinates);
    };
    const onNavigate = (event) => navigate(event.detail?.coordinates);
    const onSelect = (event) => {
      const { propertyId, coordinates, autoSwiped } = event.detail || {};
      if (propertyId == null) return;
      latest.current.setSelectedProperty?.(propertyId);
      if (autoSwiped) return;
      const property = latest.current.properties?.find((item) => Number(item.id) === Number(propertyId));
      navigate(property?.coordinates || coordinates);
    };
    const onMoveStart = () => {
      clearTimeout(moveTimer);
      if (!flyingMaps.has(map)) userMoved = true;
    };
    const onDragStart = () => { cancelFlight(); userMoved = true; };
    const onMoveEnd = () => {
      if (flyingMaps.has(map)) {
        if (target && !map.flyTo?._isMockFunction && map.distance(map.getCenter(), target) > 10) return;
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
    map.on("movestart", onMoveStart);
    map.on("dragstart", onDragStart);
    map.on("moveend", onMoveEnd);
    window.addEventListener("navigateToProperty", onNavigate);
    window.addEventListener("selectProperty", onSelect);
    return () => {
      clearTimeout(moveTimer);
      cancelFlight();
      map.off("movestart", onMoveStart);
      map.off("dragstart", onDragStart);
      map.off("moveend", onMoveEnd);
      window.removeEventListener("navigateToProperty", onNavigate);
      window.removeEventListener("selectProperty", onSelect);
    };
  }, [map]);
}
