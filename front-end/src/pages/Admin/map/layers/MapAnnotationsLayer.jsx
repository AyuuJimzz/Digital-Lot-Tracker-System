import React from "react";
import { Marker } from "react-leaflet";

export const MapAnnotationsLayer = ({
  allPropertiesAnnotations = [],
  selectedProperty,
  isEditingAnnotations,
  showAnnotationPanel,
  isBulkShifting,
  bulkShiftOffset = { lat: 0, lng: 0 },
  activeAnnotationId,
  createRoadLabelIcon,
  setSelectedProperty,
  setActiveAnnotationId,
  setShowAnnotationPanel,
  handleUpdateAnnotation,
}) => {
  if (!allPropertiesAnnotations || allPropertiesAnnotations.length === 0) return null;

  return (
    <>
      {allPropertiesAnnotations.map((item) => {
        const isThisPropActive = Number(item.property_id) === Number(selectedProperty);
        const isInteractive =
          isEditingAnnotations && showAnnotationPanel && isThisPropActive && !isBulkShifting;
        const itemLat =
          isBulkShifting && isThisPropActive ? item.lat + bulkShiftOffset.lat : item.lat;
        const itemLng =
          isBulkShifting && isThisPropActive ? item.lng + bulkShiftOffset.lng : item.lng;

        return (
          <Marker
            key={`${item.property_id || "p"}-${item.id}`}
            position={[itemLat, itemLng]}
            draggable={isInteractive}
            interactive={isInteractive}
            icon={createRoadLabelIcon(
              item,
              isInteractive,
              activeAnnotationId === item.id && isThisPropActive
            )}
            eventHandlers={
              isInteractive
                ? {
                    click: () => {
                      if (isBulkShifting) return;
                      if (item.property_id && Number(item.property_id) !== Number(selectedProperty)) {
                        setSelectedProperty(item.property_id);
                      }
                      setActiveAnnotationId(item.id);
                      setShowAnnotationPanel(true);
                    },
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      handleUpdateAnnotation(item.id, { lat, lng });
                    },
                  }
                : undefined
            }
          />
        );
      })}
    </>
  );
};

export default MapAnnotationsLayer;
