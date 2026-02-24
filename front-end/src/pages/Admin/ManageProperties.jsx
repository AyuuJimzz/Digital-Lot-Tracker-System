import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const ManageProperties = () => {
	// ============================================================
	// STATE MANAGEMENT
	// ============================================================
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingProperty, setEditingProperty] = useState(null);
	const [formData, setFormData] = useState({
		property_name: "",
		location: "",
		description: "",
		total_lots: 0,
		status: "active",
	});

	const navigate = useNavigate();

	// ============================================================
	// FETCH PROPERTIES - Get all properties from API
	// ============================================================
	const fetchProperties = useCallback(async () => {
		try {
			const response = await fetch("http://localhost:5000/api/properties", {
				credentials: "include",
			});

			if (response.status === 401 || response.status === 403) {
				navigate("/access-denied?status=401&message=Unauthorized");
				return;
			}

			if (!response.ok) {
				throw new Error("Failed to fetch properties");
			}

			const data = await response.json();
			setProperties(data);
			setLoading(false);
		} catch (err) {
			setError(err.message);
			setLoading(false);
		}
	}, [navigate]);

	useEffect(() => {
		fetchProperties();
	}, [fetchProperties]);

	// ============================================================
	// FORM INPUT HANDLER
	// ============================================================
	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	// ============================================================
	// SUBMIT FORM - Add or Update property
	// ============================================================
	const handleSubmit = async (e) => {
		e.preventDefault();

		try {
			const url = editingProperty ? `http://localhost:5000/api/properties/${editingProperty.property_id}` : "http://localhost:5000/api/properties";

			const method = editingProperty ? "PUT" : "POST";

			const response = await fetch(url, {
				method: method,
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(formData),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to save property");
			}

			await fetchProperties();
			resetForm();
			alert(editingProperty ? "Property updated successfully" : "Property added successfully");
		} catch (err) {
			alert(err.message);
		}
	};

	// ============================================================
	// EDIT PROPERTY - Populate form with property data
	// ============================================================
	const handleEdit = (property) => {
		setEditingProperty(property);
		setFormData({
			property_name: property.property_name,
			location: property.location,
			description: property.description || "",
			total_lots: property.total_lots || 0,
			status: property.status,
		});
		setShowForm(true);
	};

	// ============================================================
	// TOGGLE STATUS - Change property status (active/inactive)
	// ============================================================
	const handleToggleStatus = async (propertyId, currentStatus) => {
		const newStatus = currentStatus === "active" ? "inactive" : "active";

		try {
			const response = await fetch(`http://localhost:5000/api/properties/${propertyId}/status`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ status: newStatus }),
			});

			if (!response.ok) {
				throw new Error("Failed to update property status");
			}

			await fetchProperties();
			alert(`Property status changed to ${newStatus}`);
		} catch (err) {
			alert(err.message);
		}
	};

	// ============================================================
	// DELETE PROPERTY - Remove property from database
	// ============================================================
	const handleDelete = async (propertyId) => {
		if (!window.confirm("Are you sure you want to delete this property?")) {
			return;
		}

		try {
			const response = await fetch(`http://localhost:5000/api/properties/${propertyId}`, {
				method: "DELETE",
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to delete property");
			}

			await fetchProperties();
			alert("Property deleted successfully");
		} catch (err) {
			alert(err.message);
		}
	};

	// ============================================================
	// RESET FORM - Clear form data and cancel editing
	// ============================================================
	const resetForm = () => {
		setFormData({
			property_name: "",
			location: "",
			description: "",
			total_lots: 0,
			status: "active",
		});
		setEditingProperty(null);
		setShowForm(false);
	};

	// ============================================================
	// RENDER UI
	// ============================================================
	if (loading) {
		return <div className="flex items-center justify-center h-64">Loading properties...</div>;
	}

	if (error) {
		return <div className="text-red-600 p-4">Error: {error}</div>;
	}

	return (
		<div className="space-y-6">
			{/* Header Section */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">Manage Properties</h1>
				<button onClick={() => setShowForm(!showForm)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
					{showForm ? "Cancel" : "+ Add New Property"}
				</button>
			</div>

			{/* Form Section */}
			{showForm && (
				<div className="bg-white shadow rounded-lg p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">{editingProperty ? "Edit Property" : "Add New Property"}</h2>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
								<input type="text" name="property_name" value={formData.property_name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Total Lots</label>
								<input type="number" name="total_lots" value={formData.total_lots} onChange={handleInputChange} min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
							<textarea name="location" value={formData.location} onChange={handleInputChange} rows="2" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
							<textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
							<select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>

						<div className="flex gap-3 pt-4">
							<button type="submit" className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
								{editingProperty ? "Update Property" : "Add Property"}
							</button>
							<button type="button" onClick={resetForm} className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Table Section */}
			<div className="bg-white shadow rounded-lg overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-200">
					<h2 className="text-lg font-semibold text-gray-900">Property List ({properties.length})</h2>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property Name</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Lots</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
								<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{properties.length === 0 ? (
								<tr>
									<td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
										No properties found
									</td>
								</tr>
							) : (
								properties.map((property) => (
									<tr key={property.property_id} className="hover:bg-gray-50">
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{property.property_id}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{property.property_name}</td>
										<td className="px-6 py-4 text-sm text-gray-500">{property.location}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.total_lots}</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${property.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{property.status.toUpperCase()}</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(property.created_at).toLocaleDateString()}</td>
										<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
											<button onClick={() => handleEdit(property)} className="text-blue-600 hover:text-blue-900 mr-3">
												Edit
											</button>
											<button onClick={() => handleToggleStatus(property.property_id, property.status)} className="text-yellow-600 hover:text-yellow-900 mr-3">
												{property.status === "active" ? "Deactivate" : "Activate"}
											</button>
											<button onClick={() => handleDelete(property.property_id)} className="text-red-600 hover:text-red-900">
												Delete
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
