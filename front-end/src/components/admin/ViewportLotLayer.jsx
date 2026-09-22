import React, { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { lotIntersectsBounds } from "../../utils/lotViewport";

export function ViewportLotLayer({ lots, renderLot, showTooltips, isTouchDevice, offsetPropertyId, offset }) {
  const map = useMap();
  const renderer = useMemo(() => L.canvas({ padding: 0.5, pane: "lot-plan" }), []);
  const tooltip = useMemo(() => L.tooltip({
    pane: "tooltipPane", direction: "top", offset: [0, -18], interactive: false, opacity: 0.95,
  }), []);
  const [bounds, setBounds] = useState(() => map.getBounds().pad(0.5));
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const updateBounds = () => setBounds(map.getBounds().pad(0.5));
    const clearHover = () => setHovered(null);
    map.on("moveend zoomend resize", updateBounds);
    map.on("movestart zoomstart", clearHover);
    return () => {
      map.off("moveend zoomend resize", updateBounds);
      map.off("movestart zoomstart", clearHover);
    };
  }, [map]);

  useEffect(() => setHovered(null), [lots]);

  useEffect(() => {
    if (!hovered || isTouchDevice || !showTooltips) {
      map.closeTooltip(tooltip);
      return;
    }
    const lot = hovered.lot;
    tooltip.setLatLng(hovered.position);
    tooltip.setContent(renderToStaticMarkup(
      <div className="text-center text-xs leading-tight">
        <div className="mb-1 font-bold text-slate-900">{lot.lot_number}</div>
        <div className="mb-1 text-[12px] text-gray-600">{lot.area_sqm} sqm</div>
        <div className="mb-1 text-[12px] font-bold" style={{ color: lot._statusColor }}>
          {lot._nonSaleable ? "Non-Saleable" : lot.status}
        </div>
        {(lot.status === "Pending" || lot.status === "Sold") && lot.customer && (
          <div className="mt-2 pt-2 border-t border-gray-300 text-[11px] text-gray-700">
            <div className="font-semibold">Customer Info:</div>
            <div>{lot.customer.full_name || "N/A"}</div>
            <div className="text-gray-600">{lot.customer.email || "N/A"}</div>
            <div className="text-gray-600">{lot.customer.contact_number || "N/A"}</div>
          </div>
        )}
      </div>
    ));
    map.openTooltip(tooltip);
  }, [map, tooltip, hovered, isTouchDevice, showTooltips]);

  useEffect(() => () => map.closeTooltip(tooltip), [map, tooltip]);

  const showHover = useCallback((lot, position) => {
    if (isTouchDevice || !showTooltips) return;
    setHovered((previous) => previous?.lot.lot_id === lot.lot_id ? previous : { lot, position });
  }, [isTouchDevice, showTooltips]);
  const hideHover = useCallback((lot) => {
    setHovered((previous) => previous?.lot.lot_id === lot.lot_id ? null : previous);
  }, []);

  const visibleLots = useMemo(() => lots.filter((lot) => lotIntersectsBounds(
    lot._bounds,
    bounds,
    Number(lot.property_id) === Number(offsetPropertyId) ? offset : undefined
  )), [lots, bounds, offsetPropertyId, offset]);
  const lotNodes = useMemo(() => visibleLots.map((lot) =>
    renderLot(lot, showHover, hideHover, renderer)
  ), [visibleLots, renderLot, showHover, hideHover, renderer]);

  return <>{lotNodes}</>;
}
