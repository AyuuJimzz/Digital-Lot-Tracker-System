import React from "react";
import { Marker, Pane } from "react-leaflet";

export const MapAnnotationsLayer = ({
  allPropertiesAnnotations = [],
  selectedProperty,
  isEditingAnnotations,
  showAnnotationPanel,
  isBulkShifting,
  bulkShiftOffset = { lat: 0, lng: 0 },
  activeAnnotationId,
  selectedAnnotationIds = [],
  createRoadLabelIcon,
  setSelectedProperty,
  setActiveAnnotationId,
  setSelectedAnnotationIds,
  setShowAnnotationPanel,
  handleUpdateAnnotation,
}) => {
  if (!allPropertiesAnnotations || allPropertiesAnnotations.length === 0) return null;

  const isEditingActive = isEditingAnnotations && showAnnotationPanel && !isBulkShifting;

  return (
    <Pane name="map-annotations-pane" style={{ zIndex: isEditingActive ? 680 : 450 }}>
      {allPropertiesAnnotations.map((item) => {
        const isThisPropActive =
          !item.property_id ||
          !selectedProperty ||
          Number(item.property_id) === Number(selectedProperty);
        const isInteractive =
          isEditingAnnotations && showAnnotationPanel && isThisPropActive && !isBulkShifting;
        const itemLat =
          isBulkShifting && isThisPropActive ? item.lat + bulkShiftOffset.lat : item.lat;
        const itemLng =
          isBulkShifting && isThisPropActive ? item.lng + bulkShiftOffset.lng : item.lng;

        const isSelected =
          isThisPropActive &&
          ((selectedAnnotationIds && selectedAnnotationIds.length > 0)
            ? selectedAnnotationIds.includes(item.id)
            : activeAnnotationId === item.id);

        return (
          <Marker
            key={`${item.property_id || "p"}-${item.id}-${isInteractive ? "edit" : "view"}`}
            position={[itemLat, itemLng]}
            draggable={isInteractive}
            interactive={isInteractive}
            icon={createRoadLabelIcon(
              item,
              isInteractive,
              isSelected
            )}
            eventHandlers={
              isInteractive
                ? {
                    click: (e) => {
                      if (e?.originalEvent) {
                        e.originalEvent.stopPropagation();
                      }
                      if (isBulkShifting) return;
                      if (item.property_id && Number(item.property_id) !== Number(selectedProperty)) {
                        setSelectedProperty(item.property_id);
                      }
                      if (e?.originalEvent?.shiftKey || e?.originalEvent?.ctrlKey || e?.originalEvent?.metaKey) {
                        if (setSelectedAnnotationIds) {
                          setSelectedAnnotationIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          );
                        }
                      } else {
                        setActiveAnnotationId(item.id);
                        if (setSelectedAnnotationIds) {
                          setSelectedAnnotationIds([item.id]);
                        }
                      }
                      setShowAnnotationPanel(true);
                    },
                    dragstart: (e) => {
                      if (e?.originalEvent) {
                        e.originalEvent.stopPropagation();
                      }
                      setActiveAnnotationId(item.id);
                      if (setSelectedAnnotationIds) {
                        setSelectedAnnotationIds((prev) =>
                          prev.includes(item.id) ? prev : [item.id]
                        );
                      }
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
    </Pane>
  );
};

export default MapAnnotationsLayer;
