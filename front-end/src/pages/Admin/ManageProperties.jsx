import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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

const ManageProperties = () => {
  const [properties, setProperties] = useState(() => {
    try {
      const cached = sessionStorage.getItem("propertiesCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("propertiesCache"));
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState({
    property_name: "",
    location: "",
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

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const authConfig = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const response = await axios.get(`${API_BASE_URL}/api/properties`, authConfig);
      setProperties(response.data);
      try {
        sessionStorage.setItem("propertiesCache", JSON.stringify(response.data));
      } catch (e) {}
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/access-denied?status=401&message=Unauthorized");
        return;
      }
      setError(err.message || "Failed to fetch properties");
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ property_name: "", location: "", total_lots: 0, status: "active" });
    setEditingProperty(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      if (editingProperty) {
        await axios.put(url, formData, authConfig);
      } else {
        const res = await axios.post(url, formData, authConfig);
        createdPropId = res.data?.property_id;
      }

      setSubmitStatus("Locating property coordinates on map...");

      // Automatically search/geocode the address for GPS coordinates
      if (formData.location || formData.property_name) {
        const targetId = createdPropId || editingProperty?.property_id;
        const resolvedCoords = await resolvePropertyCoordinates(
          formData.location,
          formData.property_name
        );

        if (resolvedCoords && targetId) {
          localStorage.setItem(
            "propertyCustomCoords_" + targetId,
            JSON.stringify(resolvedCoords)
          );
        }
      }

      setSubmitStatus("Updating map caches...");

      // Invalidate caches so map view gets fresh data immediately
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
      } catch (err) {}

      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await fetchProperties();
      resetForm();

      if (!editingProperty && createdPropId) {
        setSubmitStatus("Redirecting to map view...");
        localStorage.setItem("selectedProperty", createdPropId.toString());
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
    setFormData({
      property_name: property.property_name,
      location: property.location,
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
      await fetchProperties();
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
        if (Number(localStorage.getItem("selectedProperty")) === Number(propertyId)) {
          localStorage.removeItem("selectedProperty");
        }
      } catch (err) {}
      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await fetchProperties();
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
    return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>;
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
      <div className="flex items-center justify-between">
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
            className="inline-flex items-center px-4 py-2 rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-blue-500/20 transition-all cursor-pointer"
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
