import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config/api";
import { showToast } from "../../../../components/GlobalToast";
import { autoIncrementLotNumber, offsetPolygonAdjacent } from "../../../../utils/geoUtils";
import { getAuthConfig } from "../utils/mapConstants";

export const useLotPersistence = ({
  editingLot,
  setEditingLot,
  editingCoords,
  setEditingCoords,
  dragCoordsRef,
  quickLotNumber,
  setQuickLotNumber,
  quickAreaSqm,
  setQuickAreaSqm,
  quickStatus,
  setQuickStatus,
  selectedProperty,
  targetAreaSqm,
  getNextSuggestedLotNumber,
  handleLotUpdated,
}) => {
  const [isSavingCoords, setIsSavingCoords] = useState(false);

  const handleSaveUnifiedLot = async () => {
    if (!editingLot || editingCoords.length < 3) {
      showToast("Please ensure the lot has at least 3 corner points.", "warning");
      return;
    }

    setIsSavingCoords(true);
    try {
      if (editingLot.isNew) {
        const lotNum = (quickLotNumber || editingLot.lot_number || getNextSuggestedLotNumber()).trim();
        const area = parseFloat(quickAreaSqm || editingLot.area_sqm) || 100;
        const status = quickStatus || editingLot.status || "Available";
        const propId = parseInt(selectedProperty || editingLot.property_id);

        if (!lotNum) {
          showToast("Please enter a lot identifier or number.", "warning");
          setIsSavingCoords(false);
          return;
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/lots`,
          {
            property_id: propId,
            lot_number: lotNum,
            area_sqm: area,
            status: status,
          },
          { withCredentials: true, ...getAuthConfig() }
        );

        const newLotId = response.data.lot_id;

        await axios.put(
          `${API_BASE_URL}/api/lots/${newLotId}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

        showToast(`Lot ${lotNum} created and positioned successfully!`, "success");
      } else {
        await axios.put(
          `${API_BASE_URL}/api/lots/${editingLot.lot_id}/coordinates`,
          { coordinates: editingCoords },
          getAuthConfig()
        );

        const currentLotNum = (quickLotNumber || editingLot.lot_number || "").trim();
        const currentArea = parseFloat(quickAreaSqm || editingLot.area_sqm || targetAreaSqm) || 100;
        if (currentLotNum) {
          try {
            await axios.put(
              `${API_BASE_URL}/api/lots/${editingLot.lot_id}/details`,
              {
                lot_number: currentLotNum,
                area_sqm: currentArea,
              },
              getAuthConfig()
            );
          } catch (e) {
            console.warn("Could not update lot details:", e);
          }
        }

        const currentStatus = quickStatus || editingLot.status;
        if (currentStatus) {
          try {
            await axios.put(
              `${API_BASE_URL}/api/lots/${editingLot.lot_id}/status`,
              { status: currentStatus },
              getAuthConfig()
            );
          } catch (e) {
            console.warn("Could not update lot status:", e);
          }
        }

        showToast("Coordinates updated successfully!", "success");
      }

      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}

      if (handleLotUpdated) await handleLotUpdated();
      setEditingLot(null);
      setEditingCoords([]);
    } catch (err) {
      console.error("Error saving lot coordinates:", err);
      showToast(err.response?.data?.error || err.message || "Failed to save lot coordinates", "error");
    } finally {
      setIsSavingCoords(false);
    }
  };

  const handleSaveUnifiedAndNext = async () => {
    if (!editingLot || editingCoords.length < 3) {
      showToast("Please ensure the lot has at least 3 corner points.", "warning");
      return;
    }

    setIsSavingCoords(true);
    try {
      const lotNum = (quickLotNumber || editingLot.lot_number || getNextSuggestedLotNumber()).trim();
      const area = parseFloat(quickAreaSqm || editingLot.area_sqm) || 100;
      const status = quickStatus || editingLot.status || "Available";
      const propId = parseInt(selectedProperty || editingLot.property_id);

      if (!lotNum) {
        showToast("Please enter a lot identifier or number.", "warning");
        setIsSavingCoords(false);
        return;
      }

      let currentId = editingLot.lot_id;
      if (editingLot.isNew) {
        const response = await axios.post(
          `${API_BASE_URL}/api/lots`,
          {
            property_id: propId,
            lot_number: lotNum,
            area_sqm: area,
            status: status,
          },
          { withCredentials: true, ...getAuthConfig() }
        );
        currentId = response.data.lot_id;
      }

      await axios.put(
        `${API_BASE_URL}/api/lots/${currentId}/coordinates`,
        { coordinates: editingCoords },
        getAuthConfig()
      );

      try {
        sessionStorage.removeItem("mapDataCache");
      } catch (e) {}
      if (handleLotUpdated) await handleLotUpdated();

      const nextNum = autoIncrementLotNumber(lotNum);
      const nextCoords = offsetPolygonAdjacent(editingCoords);

      setQuickLotNumber(nextNum);
      setQuickAreaSqm(area);
      setQuickStatus("Available");
      setEditingCoords(nextCoords.map((c) => [...c]));
      if (dragCoordsRef) {
        dragCoordsRef.current = nextCoords.map((c) => [...c]);
      }

      setEditingLot({
        isNew: true,
        lot_number: nextNum,
        area_sqm: area,
        status: "Available",
        property_id: propId,
      });
    } catch (err) {
      console.error("Error in Save & Next:", err);
      showToast(err.response?.data?.error || err.message || "Failed to save and add next lot", "error");
    } finally {
      setIsSavingCoords(false);
    }
  };

  return {
    isSavingCoords,
    setIsSavingCoords,
    handleSaveUnifiedLot,
    handleSaveUnifiedAndNext,
  };
};

export default useLotPersistence;
