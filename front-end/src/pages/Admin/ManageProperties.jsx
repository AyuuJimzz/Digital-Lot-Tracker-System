import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, X } from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { showToast } from "../../components/GlobalToast";
import {
  PropertyTable,
  PropertyAddEditModal,
  PropertyDeleteModal,
  PropertySubmittingOverlay,
  resolvePropertyCoordinates,
} from "../../components/admin/properties";
import { getPropertyFallbackCoordinates } from "../../utils/geocoding";

const ManageProperties = () => {
  const queryClient = useQueryClient();
  const propertiesQuery = useQuery({
    queryKey: ["properties"],
    initialData: () => {
      try {
        const cached = JSON.parse(sessionStorage.getItem("propertiesCache") || "null");
        return Array.isArray(cached) ? cached : undefined;
      } catch { return undefined; }
    },
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await axios.get(`${API_BASE_URL}/api/properties`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      try { sessionStorage.setItem("propertiesCache", JSON.stringify(response.data)); } catch (e) {}
      return response.data;
    },
  });
  const properties = propertiesQuery.data || [];
  const loading = propertiesQuery.isPending;
  const error = propertiesQuery.error?.message;
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState({
    property_name: "",
    location: "",
    latitude: "",
    longitude: "",
    total_lots: 0,
    status: "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [propertyPendingDelete, setPropertyPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState("");

  const navigate = useNavigate();

  // Auto-dismiss delete success notification after 4 seconds
  useEffect(() => {
    if (!deleteSuccessMessage) return;
    const timer = setTimeout(() => setDeleteSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [deleteSuccessMessage]);

  useEffect(() => {
    if (propertiesQuery.error?.response?.status === 401 || propertiesQuery.error?.response?.status === 403) {
      navigate("/access-denied?status=401&message=Unauthorized");
    }
  }, [propertiesQuery.error, navigate]);

  const handleInputChange = (e) => {
    if (e?.target) {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else if (e && typeof e === "object") {
      setFormData((prev) => ({ ...prev, ...e }));
    }
  };

  const resetForm = () => {
    setFormData({ property_name: "", location: "", latitude: "", longitude: "", total_lots: 0, status: "active" });
    setEditingProperty(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitStatus(editingProperty ? "Updating property..." : "Creating property in database...");

    try {
      let createdPropId = null;
      const token = localStorage.getItem("authToken");
      const authConfig = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const url = editingProperty
        ? `${API_BASE_URL}/api/properties/${editingProperty.property_id}`
        : `${API_BASE_URL}/api/properties`;

      const payload = {
        property_name: formData.property_name,
        location: formData.location,
        total_lots: formData.total_lots,
        status: formData.status,
      };

      if (editingProperty) {
        await axios.put(url, payload, authConfig);
      } else {
        const res = await axios.post(url, payload, authConfig);
        createdPropId = res.data?.property_id;
      }

      setSubmitStatus("Locating property coordinates on map...");

      const targetId = createdPropId || editingProperty?.property_id;
      const customLat = parseFloat(formData.latitude);
      const customLng = parseFloat(formData.longitude);
      let resolvedCoords = null;

      if (Number.isFinite(customLat) && Number.isFinite(customLng) && targetId) {
        // 1. Save custom coordinates to localStorage
        localStorage.setItem(
          "propertyCustomCoords_" + targetId,
          JSON.stringify([customLat, customLng])
        );

        // 2. Persist custom coordinates directly into database annotations
        try {
          let existingAnnots = [];
          if (editingProperty?.annotations) {
            const parsed =
              typeof editingProperty.annotations === "string"
                ? JSON.parse(editingProperty.annotations)
                : editingProperty.annotations;
            if (Array.isArray(parsed)) existingAnnots = parsed.filter((a) => a.id !== "property_center");
          }
          await axios.put(
            `${API_BASE_URL}/api/properties/${targetId}/annotations`,
            {
              annotations: [
                ...existingAnnots,
                { id: "property_center", type: "property_center", lat: customLat, lng: customLng, manual: true },
              ],
            },
            authConfig
          );
        } catch (_) {}
      } else if (formData.location || formData.property_name) {
        // Fallback to geocoding if no manual GPS coordinates were provided
        resolvedCoords = await resolvePropertyCoordinates(
          formData.location,
          formData.property_name
        );

        // Anti-collision staggering: If resolved coordinates overlap with an existing property (<150m or same address),
        // stagger them immediately so the new property gets its OWN distinct coordinates and camera anchor!
        if (resolvedCoords && (!Number.isFinite(customLat) || !Number.isFinite(customLng))) {
          const existingProps = propertiesQuery.data || [];
          const hasCollision = existingProps.some((other) => {
            if (Number(other.property_id) === Number(targetId) || other.status === "inactive") return false;
            const sameLocation = other.location && formData.location && other.location.trim().toLowerCase() === formData.location.trim().toLowerCase();
            const otherCoords = getPropertyFallbackCoordinates(other.property_id, other.location, other.property_name);
            const physicallyClose = Array.isArray(otherCoords) && Math.hypot(resolvedCoords[0] - otherCoords[0], resolvedCoords[1] - otherCoords[1]) < 0.0014;
            return sameLocation || physicallyClose;
          });
          if (hasCollision) {
            const angle = ((Number(targetId || Date.now()) * 73) % 360) * (Math.PI / 180);
            const dist = 0.0022; // ~240m offset
            resolvedCoords = [resolvedCoords[0] + Math.sin(angle) * dist, resolvedCoords[1] + Math.cos(angle) * dist];
          }
        }

        if (resolvedCoords && targetId) {
          localStorage.setItem(
            "propertyCustomCoords_" + targetId,
            JSON.stringify(resolvedCoords)
          );

          try {
            let existingAnnots = [];
            if (editingProperty?.annotations) {
              const parsed =
                typeof editingProperty.annotations === "string"
                  ? JSON.parse(editingProperty.annotations)
                  : editingProperty.annotations;
              if (Array.isArray(parsed)) existingAnnots = parsed.filter((a) => a.id !== "property_center");
            }
            await axios.put(
              `${API_BASE_URL}/api/properties/${targetId}/annotations`,
              {
                annotations: [
                  ...existingAnnots,
                  { id: "property_center", type: "property_center", lat: resolvedCoords[0], lng: resolvedCoords[1], auto: true },
                ],
              },
              authConfig
            );
          } catch (_) {}
        }
      }

      setSubmitStatus("Updating map caches...");

      // Invalidate caches so map view gets fresh data immediately
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
        sessionStorage.removeItem("gde_map_data_cache_admin");
        sessionStorage.removeItem("gde_map_data_cache_employee");
      } catch (err) {}

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["map-data"] });
        queryClient.invalidateQueries({ queryKey: ["properties"] });
      }

      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await propertiesQuery.refetch();
      resetForm();

      if (!editingProperty && createdPropId) {
        setSubmitStatus("Redirecting to map view...");
        const newIdStr = createdPropId.toString();
        localStorage.setItem("selectedProperty", newIdStr);

        const initialCoords = (Number.isFinite(customLat) && Number.isFinite(customLng))
          ? [customLat, customLng]
          : resolvedCoords;

        if (initialCoords && Array.isArray(initialCoords) && initialCoords.length >= 2) {
          try {
            localStorage.setItem("propertyMapView_" + newIdStr, JSON.stringify({
              center: initialCoords,
              zoom: 19,
            }));
          } catch (_) {}
        }

        // Automatically direct user straight to the map location!
        navigate("/manage-lots");
      } else {
        showToast(
          editingProperty ? "Property updated successfully" : "Property added successfully",
          "success"
        );
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Failed to save property", "error");
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    let lat = "";
    let lng = "";
    if (property.annotations) {
      try {
        const parsed =
          typeof property.annotations === "string" ? JSON.parse(property.annotations) : property.annotations;
        const center = Array.isArray(parsed)
          ? parsed.find((a) => a.type === "property_center" || a.id === "property_center")
          : parsed?.center;
        if (center) {
          lat = center.lat;
          lng = center.lng;
        }
      } catch (_) {}
    }
    if (!lat && property.coordinates && Array.isArray(property.coordinates)) {
      lat = property.coordinates[0];
      lng = property.coordinates[1];
    }
    setFormData({
      property_name: property.property_name,
      location: property.location,
      latitude: lat || "",
      longitude: lng || "",
      total_lots: property.total_lots || 0,
      status: property.status,
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (propertyId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const token = localStorage.getItem("authToken");
      const authConfig = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      await axios.patch(
        `${API_BASE_URL}/api/properties/${propertyId}/status`,
        { status: newStatus },
        authConfig
      );
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
        if (
          newStatus === "inactive" &&
          Number(localStorage.getItem("selectedProperty")) === Number(propertyId)
        ) {
          localStorage.removeItem("selectedProperty");
        }
      } catch (err) {}
      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await propertiesQuery.refetch();
      showToast(`Property status changed to ${newStatus}`, "success");
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Failed to update property status", "error");
    }
  };

  const openDeleteModal = (property) => {
    setDeleteError("");
    setPropertyPendingDelete(property);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setPropertyPendingDelete(null);
    setDeleteError("");
  };

  const confirmDeleteProperty = async () => {
    if (!propertyPendingDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    const propertyId = propertyPendingDelete.property_id;
    const propertyName = propertyPendingDelete.property_name;

    try {
      const token = localStorage.getItem("authToken");
      const authConfig = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      await axios.delete(`${API_BASE_URL}/api/properties/${propertyId}`, authConfig);
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
        localStorage.removeItem("propertyCustomCoords_" + propertyId);
        localStorage.removeItem("propertyMapView_" + propertyId);
        if (Number(localStorage.getItem("selectedProperty")) === Number(propertyId)) {
          localStorage.removeItem("selectedProperty");
        }
      } catch (err) {}
      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await propertiesQuery.refetch();
      setPropertyPendingDelete(null);
      showToast(`Property "${propertyName}" deleted successfully`, "success");
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to delete property";
      setDeleteError(errorMsg);
      showToast(errorMsg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">
        Loading properties...
      </div>
    );
  }

  if (error) {
    if (!propertiesQuery.data) return <div className="text-red-600 dark:text-red-400 p-4" role="alert">Error: {error} <button type="button" onClick={() => propertiesQuery.refetch()} className="ml-2 underline">Retry</button></div>;
  }

  return (
    <div className="space-y-6 p-6 w-full">
      {/* ── Full-Screen Creation/Update Loading Overlay ── */}
      <PropertySubmittingOverlay
        isSubmitting={isSubmitting}
        editingProperty={editingProperty}
        submitStatus={submitStatus}
      />

      {/* ── In-App Delete Confirmation Modal ── */}
      <PropertyDeleteModal
        property={propertyPendingDelete}
        isDeleting={isDeleting}
        deleteError={deleteError}
        onConfirm={confirmDeleteProperty}
        onClose={closeDeleteModal}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Properties</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Create, edit, and organize estate subdivisions & cadastres
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex w-full items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700 sm:w-auto dark:hover:bg-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Property
          </button>
        )}
      </div>

      {/* ── Add / Edit Form Modal ── */}
      <PropertyAddEditModal
        isOpen={showForm}
        editingProperty={editingProperty}
        formData={formData}
        isSubmitting={isSubmitting}
        submitStatus={submitStatus}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onClose={resetForm}
      />

      {/* ── Floating Success Toast Notification (Zero Layout Shift) ── */}
      {deleteSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/80 dark:border-slate-700 text-white rounded-2xl px-5 py-4 shadow-2xl shadow-black/40 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Success</div>
            <div className="text-sm font-semibold text-slate-100 truncate">
              {deleteSuccessMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMessage("")}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Properties Table ── */}
      <PropertyTable
        properties={properties}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={openDeleteModal}
      />
    </div>
  );
};

export default ManageProperties;
