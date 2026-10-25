import React from "react";
import { Marker, Pane } from "react-leaflet";

export const MapAnnotationsLayer = ({
  allPropertiesAnnotations = [],
  selectedProperty,
  isEditingAnnotations,
  showAnnotationPanel,
  isBulkShifting,
  bulkShiftOffset = { lat: 0, lng: 0 },
  isBlockAdjusting,
  transformedAnnotationsMap,
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
        let itemLat = item.lat;
        let itemLng = item.lng;
        let itemRotation = item.rotation || 0;

        if (isBulkShifting && isThisPropActive) {
          itemLat = item.lat + bulkShiftOffset.lat;
          itemLng = item.lng + bulkShiftOffset.lng;
        } else if (isBlockAdjusting && isThisPropActive && transformedAnnotationsMap?.has(String(item.id))) {
          const transformed = transformedAnnotationsMap.get(String(item.id));
          itemLat = transformed.lat;
          itemLng = transformed.lng;
          itemRotation = transformed.rotation;
        }

        const itemToRender =
          itemLat !== item.lat || itemLng !== item.lng || itemRotation !== (item.rotation || 0)
            ? { ...item, lat: itemLat, lng: itemLng, rotation: itemRotation }
            : item;

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
              itemToRender,
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
                      const isMultiSelect = selectedAnnotationIds && selectedAnnotationIds.length > 1;
                      if (e?.originalEvent?.shiftKey || e?.originalEvent?.ctrlKey || e?.originalEvent?.metaKey || isMultiSelect) {
                        if (setSelectedAnnotationIds) {
                          setSelectedAnnotationIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          );
                        }
                        setActiveAnnotationId(item.id);
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
