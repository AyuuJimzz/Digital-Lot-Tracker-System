import React from "react";
import { Popup } from "react-leaflet";
import axios from "axios";
import { API_BASE_URL } from "../../../../config/api";

export const MapTouchPopup = ({
  activePopupLot,
  setActivePopupLot,
  properties = [],
  selectedProperty,
  setSelectedLot,
  setIsOffcanvasOpen,
}) => {
  if (!activePopupLot) return null;

  return (
    <Popup
      position={activePopupLot.position}
      onClose={() => setActivePopupLot(null)}
      className="lot-preview-touch-popup"
      autoPan={false}
      offset={[0, -10]}
    >
      <div style={{ minWidth: "140px", padding: "2px" }} className="text-center">
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>
          {activePopupLot.lot_number}
        </div>
        <div style={{ fontSize: "11.5px", color: "#475569", marginBottom: "6px" }}>
          {activePopupLot.area_sqm} sqm
        </div>
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            backgroundColor: `${activePopupLot.statusColor}22`,
            color: activePopupLot.statusColor,
            marginBottom:
              (activePopupLot.status === "Pending" || activePopupLot.status === "Sold") &&
              activePopupLot.customer
                ? "4px"
                : "8px",
          }}
        >
          {activePopupLot.status}
        </div>

        {(activePopupLot.status === "Pending" || activePopupLot.status === "Sold") &&
          activePopupLot.customer && (
            <div
              style={{
                marginTop: "4px",
                marginBottom: "8px",
                paddingTop: "6px",
                borderTop: "1px solid #e2e8f0",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 600, color: "#334155", marginBottom: "2px" }}>Customer Info:</div>
              <div style={{ color: "#0f172a", fontWeight: 500 }}>
                {activePopupLot.customer.full_name || "N/A"}
              </div>
              <div style={{ color: "#64748b", fontSize: "10.5px", wordBreak: "break-all" }}>
                {activePopupLot.customer.email || "N/A"}
              </div>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>
                {activePopupLot.customer.contact_number || "N/A"}
              </div>
            </div>
          )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const matchingProp = properties.find(
              (p) => Number(p.id) === Number(activePopupLot.property_id || selectedProperty)
            );
            const propName = matchingProp?.name || matchingProp?.property_name || "Golden Dragon Estate";
            const propLocation = matchingProp?.location || matchingProp?.name || "Guimbal, Iloilo";

            setSelectedLot({
              ...activePopupLot,
              property_name: activePopupLot.property_name || propName,
              location: activePopupLot.location || propLocation,
            });
            setIsOffcanvasOpen(true);
            setActivePopupLot(null);

            axios
              .get(`${API_BASE_URL}/api/lots/${activePopupLot.lot_id}`)
              .then((res) => {
                setSelectedLot((prev) =>
                  prev && prev.lot_id === activePopupLot.lot_id ? { ...prev, ...res.data } : prev
                );
              })
              .catch(() => {});
          }}
          style={{
            width: "100%",
            padding: "6px 10px",
            backgroundColor: "#10b981",
            color: "#ffffff",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
          }}
        >
          <span>View Details</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </Popup>
  );
};

export default MapTouchPopup;
