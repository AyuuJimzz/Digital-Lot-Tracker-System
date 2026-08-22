import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Edit, Trash2, Plus, Eye, EyeOff, X } from "lucide-react";
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

      // Invalidate caches so map view gets fresh data immediately
      try {
        sessionStorage.removeItem("propertiesCache");
        sessionStorage.removeItem("mapDataCache");
      } catch (err) {}

      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await fetchProperties();
      resetForm();

      if (!editingProperty && createdPropId) {
        localStorage.setItem("selectedProperty", createdPropId.toString());
        // Automatically direct user straight to the map location!
        navigate("/manage-lots");
      } else {
        alert(editingProperty ? "Property updated successfully" : "Property added successfully");
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save property");
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
      try { sessionStorage.removeItem("propertiesCache"); } catch (err) {}
      window.dispatchEvent(new CustomEvent("propertiesUpdated"));
      await fetchProperties();
      alert(`Property status changed to ${newStatus}`);
    } catch (err) { alert(err.message || "Failed to update property status"); }
  };

  const handleDelete = async (propertyId) => {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/properties/${propertyId}`, { withCredentials: true });
      try { sessionStorage.removeItem("propertiesCache"); } catch (err) {}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Total Lots</label>
                <input
                  type="number"
                  name="total_lots"
                  value={formData.total_lots}
                  onChange={handleInputChange}
                  min="0"
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/25 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              >
                {editingProperty ? "Save Changes" : "Create & Locate on Map"}
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
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                {["ID", "Property Name", "Location", "Total Lots", "Status", "Created At", "Actions"].map((col) => (
                  <th key={col} className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {properties.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-slate-400">No properties found</td></tr>
              ) : (
                properties.map((property) => (
                  <tr key={property.property_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">{property.property_id}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{property.property_name}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{property.location}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{property.total_lots}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${property.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {property.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{new Date(property.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleEdit(property)} className="inline-flex items-center justify-center w-8 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(property.property_id, property.status)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md shadow-sm text-sm font-medium mx-2 transition-colors ${
                          property.status === "active"
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                            : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                        }`}
                        title={property.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {property.status === "active" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(property.property_id)} className="inline-flex items-center justify-center w-8 h-8 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
