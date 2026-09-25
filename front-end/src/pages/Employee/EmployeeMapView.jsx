import React from "react";
import L from "leaflet";
import { MapContainer, Pane, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Modular Map Layers and Components (Shared with Admin Map)
import { ViewportLotLayer } from "../../components/admin/ViewportLotLayer";
import { MapLocationSearch } from "../../components/admin/MapLocationSearch";
import {
  MapLayerControls,
  ActiveMapTileLayer,
} from "../../components/admin/MapLayerControls";
import LotOffcanvas from "../../components/admin/LotOffcanvas";

import MapController from "../Admin/map/components/MapController";
import MapTouchPopup from "../Admin/map/components/MapTouchPopup";
import OverviewBeaconsLayer from "../Admin/map/layers/OverviewBeaconsLayer";

// Custom Hook for Employee Map State & Calculations
import { useEmployeeMapView } from "./hooks/useEmployeeMapView";

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function EmployeeMapView() {
  const mapState = useEmployeeMapView();

  if (!mapState.mapData) {
    return <div className="p-5 text-gray-600 dark:text-slate-400 text-sm">
      {mapState.mapError ? (
        <div role="alert">
          <p>Unable to load Estate Map. Please check your connection.</p>
          <button type="button" onClick={() => mapState.retryMapData()} className="mt-2 text-blue-500 underline">Retry</button>
        </div>
      ) : "Loading Estate Map..."}
    </div>;
  }

  const {
    mapWrapperRef,
    properties,
    selectedPropertyCoords,
    mapLayer,
    setMapLayer,
    selectedProperty,
    setSelectedProperty,
    setCurrentZoom,
    triggerArrivalPulse,
    filteredLots,
    renderLot,
    showLotTooltips,
    isTouchDevice,
    activePopupLot,
    setActivePopupLot,
    selectedLot,
    setSelectedLot,
    isOffcanvasOpen,
    setIsOffcanvasOpen,
    handleCloseOffcanvas,
    handleLotUpdated,
    allPropertyAnnotations,
    createRoadLabelIcon,
  } = mapState;

  const propertyName =
    properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
    selectedLot?.property_name ||
    "Golden Dragon Estate";

  const propertyLocation =
    properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.location ||
    properties.find((p) => Number(p.id) === Number(selectedLot?.property_id || selectedProperty))?.name ||
    selectedLot?.location ||
    "Guimbal, Iloilo";

  return (
    <div
      ref={mapWrapperRef}
      className="w-full h-full relative"
      style={{ height: "calc(100vh - 3.5rem)", zIndex: 1 }}
    >
      <MapContainer
        center={properties && properties.length > 0 ? selectedPropertyCoords : [10.90, 122.60]}
        zoom={properties && properties.length > 0 ? 19 : 9}
        preferCanvas={true}
        zoomDelta={0.25}
        zoomSnap={0}
        wheelPxPerZoomLevel={220}
        wheelDebounceTime={20}
        minZoom={7}
        maxZoom={28}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        fadeAnimation={false}
        markerZoomAnimation={true}
        touchZoom={true}
        tap={false}
        bounceAtZoomLimits={false}
        inertia={true}
        inertiaDeceleration={6000}
        inertiaMaxSpeed={700}
        style={{ height: "100%", width: "100%", zIndex: 1, touchAction: "manipulation" }}
      >
        <MapLocationSearch
          onLocationSelected={(loc) => {
            triggerArrivalPulse(loc.coordinates);
          }}
        />

        <MapLayerControls
          activeLayer={mapLayer}
          onLayerChange={setMapLayer}
          mapContainerRef={mapWrapperRef}
        />

        <MapController
          selectedProperty={selectedProperty}
          setSelectedProperty={setSelectedProperty}
          setCurrentZoom={setCurrentZoom}
          triggerArrivalPulse={triggerArrivalPulse}
          mapLayer={mapLayer}
          properties={properties}
        />

        <ActiveMapTileLayer activeLayer={mapLayer} />

        {/* Tablet Touch Preview Popup */}
        <MapTouchPopup
          activePopupLot={activePopupLot}
          setActivePopupLot={setActivePopupLot}
          properties={properties}
          selectedProperty={selectedProperty}
          setSelectedLot={setSelectedLot}
          setIsOffcanvasOpen={setIsOffcanvasOpen}
        />

        {/* Zoomed-Out Overview Property Location Beacons */}
        <OverviewBeaconsLayer
          properties={properties}
          setSelectedProperty={setSelectedProperty}
        />

        {/* Viewport-Optimized Lots Layer */}
        <Pane name="lot-plan" className="lot-plan-pane" style={{ zIndex: 410 }}>
          <ViewportLotLayer
            lots={filteredLots}
            renderLot={renderLot}
            showTooltips={showLotTooltips}
            isTouchDevice={isTouchDevice}
          />
        </Pane>

        {/* Road and subdivision text labels */}
        {allPropertyAnnotations.map((item) => (
          <Marker
            key={`${item.property_id || "p"}-${item.id}`}
            position={[item.lat, item.lng]}
            icon={createRoadLabelIcon(item)}
            interactive={false}
          />
        ))}
      </MapContainer>

      {/* Lot Details & Customer Reservation Sidebar */}
      <LotOffcanvas
        isAdmin={false}
        selectedLot={selectedLot}
        propertyName={propertyName}
        propertyLocation={propertyLocation}
        isOpen={isOffcanvasOpen}
        onClose={handleCloseOffcanvas}
        onLotUpdated={handleLotUpdated}
        allowedStatuses={["Available", "Pending", "Sold"]}
      />
    </div>
  );
}

export default EmployeeMapView;
