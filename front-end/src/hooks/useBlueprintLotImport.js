import { useCallback, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { saveBlueprintOverlay } from "../utils/overlayStorage";
import { candidateInsideCrop, importedLotIdentifier, projectLotCandidate } from "../utils/blueprintLotProjection";
import { calculateGeodesicArea } from "../utils/geoUtils";
import { PDF_LOT_DETECTOR_VERSION } from "../utils/pdfLotImport/version";

export function useBlueprintLotImport({ propertyId, map, bounds, rotation, isAligning }) {
  const [state, setState] = useState(null);
  const [reviewProperty, setReviewProperty] = useState(null);
  const [preview, setPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const currentProperty = useRef(propertyId);
  currentProperty.current = propertyId;
  const draft = state?.propertyId === propertyId ? state.data : null;

  const restore = useCallback((data) => {
    setState({ propertyId, data: data || null });
    setReviewProperty(null);
    setPreview(false);
    setError("");
    setMessage("");
  }, [propertyId]);

  const updateDraft = useCallback((data) => {
    setState({ propertyId, data });
    void saveBlueprintOverlay(propertyId, { lotImport: data }).then((saved) => {
      if (!saved && currentProperty.current === propertyId) setError("The import draft could not be saved in this browser. Keep this page open until you finish.");
    });
  }, [propertyId]);

  const candidates = useMemo(() => (draft?.candidates || []).filter((candidate) =>
    !candidate.imported && candidateInsideCrop(candidate, draft.cropBounds)
  ), [draft]);

  const projected = useMemo(() => {
    if (!map || !bounds || !draft) return [];
    return candidates.map((candidate) => ({
      ...candidate, coordinates: projectLotCandidate(candidate, draft, bounds, rotation, map),
    }));
  }, [map, bounds, draft, candidates, rotation]);

  const warnings = useMemo(() => {
    const notices = [...(draft?.warnings || [])];
    if (draft && (draft.detectorVersion || 1) < PDF_LOT_DETECTOR_VERSION) {
      notices.unshift("This saved scan uses an older detector. Use Replace file and upload the original PDF again for improved lot detection. Your current draft stays available until you replace it.");
    }
    const mismatch = projected.filter((candidate) => candidate.selected && Number(candidate.areaSqm) > 0 &&
      Math.abs(calculateGeodesicArea(candidate.coordinates) / Number(candidate.areaSqm) - 1) > 0.25
    ).length;
    if (mismatch) notices.push(`${mismatch} selected lot(s) have map areas more than 25% different from their entered areas. Check blueprint scale and alignment before creating lots.`);
    return notices;
  }, [draft, projected]);

  const changeCandidates = (next) => {
    if (saving.current) return;
    const changed = new Map(next.map((candidate) => [candidate.id, candidate]));
    updateDraft({ ...draft, candidates: draft.candidates.map((candidate) => changed.get(candidate.id) || candidate) });
    setError("");
  };

  const applyCrop = useCallback((cropBounds) => {
    if (draft) updateDraft({ ...draft, cropBounds });
    setReviewProperty(null);
  }, [draft, updateDraft]);

  const importLots = async (onImported) => {
    if (saving.current) return;
    const selected = projected.filter((candidate) => candidate.selected);
    if (isAligning || !bounds || !selected.length || !draft) {
      setError("Lock the blueprint alignment and select at least one lot first.");
      return;
    }
    saving.current = true;
    setIsImporting(true);
    setError("");
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/lots/import`, {
        property_id: propertyId,
        sourceName: `${draft.sourceName} (page ${draft.pageNumber})`,
        lots: selected.map((candidate) => ({
          lot_number: importedLotIdentifier(candidate), area_sqm: Number(candidate.areaSqm), coordinates: candidate.coordinates,
        })),
      }, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 60000,
        // A mutation with an uncertain response must be reconciled, not auto-replayed.
        _retry: true,
      });
      const importedIds = new Set(selected.map((candidate) => candidate.id));
      const next = { ...draft, candidates: draft.candidates.map((candidate) =>
        importedIds.has(candidate.id) ? { ...candidate, imported: true, selected: false } : candidate
      ) };
      await saveBlueprintOverlay(propertyId, { lotImport: next });
      if (currentProperty.current === propertyId) {
        setState({ propertyId, data: next });
        setReviewProperty(null);
        setMessage(`${response.data.createdCount || selected.length} lots created with their map boundaries.`);
      }
      await onImported();
    } catch (failure) {
      if (currentProperty.current === propertyId) {
        setError(failure.response?.data?.message || failure.response?.data?.error ||
          "Could not confirm the import result. Refresh the map and check existing lots before retrying.");
      }
      if (!failure.response) await onImported();
    } finally {
      saving.current = false;
      setIsImporting(false);
    }
  };

  return {
    draft, candidates, projected, warnings, error, message, isImporting,
    preview: Boolean(draft) && preview,
    isReviewOpen: Boolean(draft) && reviewProperty === propertyId,
    restore, applyCrop, changeCandidates, importLots,
    togglePreview: () => setPreview((value) => !value),
    openReview: () => { if (!isAligning) { setReviewProperty(propertyId); setPreview(true); setError(""); } },
    closeReview: () => { if (!saving.current) setReviewProperty(null); },
  };
}
