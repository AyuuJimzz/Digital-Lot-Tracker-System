import React from "react";
import { Polygon } from "react-leaflet";

export const LotImportCandidateLayer = ({
  lotImport,
  isEditingOverlay,
  isPreparingOverlay,
  overlayLineColor,
}) => {
  if (!lotImport?.preview || isEditingOverlay || isPreparingOverlay || !lotImport.projected) {
    return null;
  }

  const candidateColor =
    overlayLineColor === "cyan" ? "#06b6d4"
    : overlayLineColor === "white" ? "#ffffff"
    : overlayLineColor === "lime" ? "#34d399"
    : overlayLineColor === "amber" || overlayLineColor === "yellow" ? "#fbbf24"
    : overlayLineColor === "black" ? "#0f172a"
    : "#06b6d4";

  return (
    <>
      {lotImport.projected.map((candidate) => (
        <Polygon
          key={candidate.id}
          positions={candidate.coordinates}
          interactive={false}
          pathOptions={{
            color: candidate.selected ? "#10b981" : candidateColor,
            weight: 1.5,
            fillColor: candidate.selected ? "#10b981" : candidateColor,
            fillOpacity: candidate.selected ? 0.2 : 0.05,
          }}
        />
      ))}
    </>
  );
};

export default LotImportCandidateLayer;
