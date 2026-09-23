import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { usePropertyMapNavigation } from "../../../../hooks/usePropertyMapNavigation";
import { useSmoothWheelZoom } from "../../../../hooks/useSmoothWheelZoom";

export function MapController({
  selectedProperty,
  setSelectedProperty,
  triggerArrivalPulse,
  setMap,
  setCurrentZoom,
  mapLayer,
  properties,
}) {
  const map = useMap();

  useEffect(() => {
    if (setMap) setMap(map);
    if (setCurrentZoom) setCurrentZoom(map.getZoom());

    // Real-time geo-scale & street-level class tracking on DOM container
    const container = map.getContainer();
    const updateZoomClasses = (z) => {
      const scale = Math.max(0.45, Math.pow(1.4, z - 19));
      container.style.setProperty("--road-label-scale", scale);
      container.style.setProperty("--pdf-road-label-scale", Math.pow(2, z - 20));

      // Show road text labels at comfortable subdivision view (zoom >= 18.2)
      if (z >= 18.2) {
        container.classList.add("map-zoom-street-level");
      } else {
        container.classList.remove("map-zoom-street-level");
      }

      // Real-time overview beacon and tooltip decluttering (instant on threshold, no debounce delay)
      if (z < 17.5) {
        container.classList.add("map-view-zoomed-out");
        container.classList.remove("map-view-zoomed-in");
      } else {
        container.classList.add("map-view-zoomed-in");
        container.classList.remove("map-view-zoomed-out");
      }
    };
    updateZoomClasses(map.getZoom());

    const handleZoomAnim = (e) => {
      if (container.classList.contains("map-is-flying")) return;
      updateZoomClasses(e.zoom);
    };

    const handleZoom = () => {
      if (container.classList.contains("map-is-flying")) return;
      updateZoomClasses(map.getZoom());
    };

    let debounceTimer;
    const ZOOM_THRESHOLDS = [17.5, 18, 18.2, 19, 19.5];
    const handleZoomEnd = () => {
      clearTimeout(debounceTimer);
      const z = map.getZoom();
      updateZoomClasses(z);
      debounceTimer = setTimeout(() => {
        if (!setCurrentZoom) return;
        setCurrentZoom((prev) => {
          const crossed = ZOOM_THRESHOLDS.some(
            (t) => (prev < t) !== (z < t)
          );
          return crossed ? z : prev;
        });
      }, 60);
    };

    const handleDismissTooltips = () => {
      clearTimeout(debounceTimer);
      try {
        map.closeTooltip();
      } catch (e) {}
    };

    map.on("zoomanim", handleZoomAnim);
    map.on("zoom", handleZoom);
    map.on("zoomend", handleZoomEnd);
    map.on("movestart", handleDismissTooltips);
    map.on("dragstart", handleDismissTooltips);
    map.on("zoomstart", handleDismissTooltips);
    return () => {
      map.off("zoomanim", handleZoomAnim);
      map.off("zoom", handleZoom);
      map.off("zoomend", handleZoomEnd);
      map.off("movestart", handleDismissTooltips);
      map.off("dragstart", handleDismissTooltips);
      map.off("zoomstart", handleDismissTooltips);
      clearTimeout(debounceTimer);
    };
  }, [map, setMap, setCurrentZoom]);

  // Ensure map recalculates its exact full-screen dimensions and supports deep zooming
  useEffect(() => {
    if (!map) return;
    map.setMaxZoom(28);
    map.setMinZoom(7);
    map.invalidateSize();

    const handleZoomIn = () => map.zoomIn(0.5);
    const handleZoomOut = () => map.zoomOut(0.5);

    window.addEventListener("mapZoomIn", handleZoomIn);
    window.addEventListener("mapZoomOut", handleZoomOut);

    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mapZoomIn", handleZoomIn);
      window.removeEventListener("mapZoomOut", handleZoomOut);
    };
  }, [map]);

  usePropertyMapNavigation(map, {
    selectedProperty,
    setSelectedProperty,
    properties,
    mapLayer,
    triggerArrivalPulse,
  });
  useSmoothWheelZoom(map);

  // Set view to selected property directly on initial mount (no delayed flyTo jump)
  const initialFlyDoneRef = useRef(false);
  useEffect(() => {
    if (!map || initialFlyDoneRef.current) return;
    if (!properties || properties.length === 0) {
      initialFlyDoneRef.current = true;
      map.setView([10.90, 122.60], 9, { animate: false });
      return;
    }
    const targetProp = properties.find((p) => Number(p.id) === Number(selectedProperty));
    if (targetProp && targetProp.coordinates) {
      initialFlyDoneRef.current = true;
      map.setView(targetProp.coordinates, 19, { animate: false });
      map.invalidateSize({ animate: false });
    }
  }, [map, properties, selectedProperty]);

  return null;
}

export default MapController;
