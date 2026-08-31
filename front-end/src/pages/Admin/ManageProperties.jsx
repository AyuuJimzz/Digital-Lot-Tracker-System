import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Edit, Trash2, Plus, Eye, EyeOff, X, MapPin } from "lucide-react";
import { geocodeAddress } from "../../utils/geocoding";

const MUNICIPALITY_COORDINATES = {
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7372, 122.4998],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "pavia": [10.7744, 122.5408],
  "santa barbara": [10.8242, 122.5342],
  "leganes": [10.7833, 122.5833],
  "dumangas": [10.8250, 122.7167],
  "zarraga": [10.8217, 122.6108],
  "pototan": [10.9472, 122.6289],
  "janiuay": [10.9575, 122.5022],
  "miagao": [10.6444, 122.2358],
  "san joaquin": [10.5878, 122.1408],
  "tigbauan": [10.6756, 122.3811],
  "iloilo": [10.7202, 122.5621],
  "passi": [11.1075, 122.6419],
};

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all";

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
  const [formData, setFormData] = useState({ property_name: "", location: "", total_lots: 0, status: "active" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const navigate = useNavigate();

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/properties`, { withCredentials: true });
      setProperties(response.data);
      try { sessionStorage.setItem("propertiesCache", JSON.stringify(response.data)); } catch (e) {}
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/access-denied?status=401&message=Unauthorized"); return;
      }
      setError(err.message || "Failed to fetch properties");
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(editingProperty ? "Updating property..." : "Creating property in database...");

    try {
      let createdPropId = null;
      const url = editingProperty
        ? `${API_BASE_URL}/api/properties/${editingProperty.property_id}`
        : `${API_BASE_URL}/api/properties`;
      if (editingProperty) {
        await axios.put(url, formData, { withCredentials: true });
      } else {
        const res = await axios.post(url, formData, { withCredentials: true });
        createdPropId = res.data?.property_id;
      }

      setSubmitStatus("Locating property coordinates on map...");

      // Automatically search/geocode the address for GPS coordinates
      if (formData.location || formData.property_name) {
        const targetId = createdPropId || editingProperty?.property_id;
        let resolvedCoords = null;

        // 1. Instant match with known town dictionary
        const locationText = `${formData.location || ""} ${formData.property_name || ""}`.toLowerCase();
        for (const [key, coords] of Object.entries(MUNICIPALITY_COORDINATES)) {
          if (locationText.includes(key)) {
            resolvedCoords = coords;
            break;
          }
        }

        // 2. Dynamic geocoding if not found in town dictionary
        if (!resolvedCoords && formData.location) {
          try {
            const geo = await geocodeAddress(formData.location);
            if (geo && geo.lat && geo.lng) {
              resolvedCoords = [geo.lat, geo.lng];
            }
          } catch (geoErr) {
            console.warn("Geocoding notice:", geoErr);
          }
        }

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
        alert(editingProperty ? "Property updated successfully" : "Property added successfully");
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save property");
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    setFormData({ property_name: property.property_name, location: property.location, total_lots: property.total_lots || 0, status: property.status });
    setShowForm(true);
  };

  const handleToggleStatus = async (propertyId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await axios.patch(`${API_BASE_URL}/api/properties/${propertyId}/status`, { status: newStatus }, { withCredentials: true });
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
        if (newStatus === "inactive" && Number(localStorage.getItem("selectedProperty")) === Number(propertyId)) {
          localStorage.removeItem("selectedProperty");
        }
      } catch (err) {}
      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await fetchProperties();
      alert(`Property status changed to ${newStatus}`);
    } catch (err) { alert(err.message || "Failed to update property status"); }
  };

  const handleDelete = async (propertyId) => {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/properties/${propertyId}`, { withCredentials: true });
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
      alert("Property deleted successfully");
    } catch (err) { alert(err.message || "Failed to delete property"); }
  };

  const resetForm = () => {
    setFormData({ property_name: "", location: "", total_lots: 0, status: "active" });
    setEditingProperty(null);
    setShowForm(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">Loading properties...</div>;
  if (error) return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>;

  return (
    <div className="space-y-6 p-6 w-full">
      {/* ── Full-Screen Creation/Update Loading Overlay ── */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {/* Animated Radar/Spinner */}
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin"></div>
              <div className="absolute w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1.5">
              {editingProperty ? "Saving Changes..." : "Creating Property..."}
            </h3>

            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4 animate-pulse">
              {submitStatus || "Setting up property coordinates..."}
            </p>

            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mb-3">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full w-full rounded-full animate-pulse"></div>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Please wait while we initialize property GPS location and sync the map...
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Properties</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Create, edit, and organize estate subdivisions & cadastres</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-blue-500/20 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Property
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-3xl mx-auto transition-all">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingProperty ? "Edit Property Details" : "Add New Property"}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Provide property details and address for automatic GPS pin locating</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Property Name *</label>
                <input
                  type="text"
                  name="property_name"
                  value={formData.property_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Lot-3847 Pagsanga-an"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Location / Address *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Pagsanga-an, Pavia, Iloilo"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-md transition-all ${
                  isSubmitting
                    ? "bg-blue-500/80 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                }`}
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>
                  {isSubmitting
                    ? submitStatus || "Processing..."
                    : editingProperty
                      ? "Save Changes"
                      : "Create & Locate on Map"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 shadow rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Property List ({properties.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
            <thead className="bg-gray-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-14 hidden sm:table-cell">#</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Property Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Total Lots</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">Created At</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {properties.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">No properties found</td></tr>
              ) : (
                properties.map((property, index) => (
                  <tr key={property.property_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">#{index + 1}</td>
                    <td className="px-4 py-3.5 text-left text-sm font-bold text-gray-900 dark:text-white">{property.property_name}</td>
                    <td className="px-4 py-3.5 text-left text-sm text-gray-600 dark:text-slate-300">{property.location}</td>
                    <td className="px-4 py-3.5 text-center text-sm font-semibold text-gray-700 dark:text-slate-200">{property.total_lots}</td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        property.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-500/30"
                      }`}>
                        {property.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell whitespace-nowrap">{new Date(property.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(property)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          title="Edit Property"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(property.property_id, property.status)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            property.status === "active"
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300"
                              : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300"
                          }`}
                          title={property.status === "active" ? "Deactivate Property" : "Activate Property"}
                        >
                          {property.status === "active" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(property.property_id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Delete Property"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageProperties;
