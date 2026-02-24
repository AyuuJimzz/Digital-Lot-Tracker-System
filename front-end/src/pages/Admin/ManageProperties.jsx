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
		return <div>Loading properties...</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	return (
		<div>
			<h1>Manage Properties</h1>

			<button onClick={() => navigate("/admin-panel")}>Back to Dashboard</button>

			<button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Add New Property"}</button>

			{showForm && (
				<div>
					<h2>{editingProperty ? "Edit Property" : "Add New Property"}</h2>
					<form onSubmit={handleSubmit}>
						<div>
							<label>Property Name:</label>
							<input type="text" name="property_name" value={formData.property_name} onChange={handleInputChange} required />
						</div>

						<div>
							<label>Location:</label>
							<textarea name="location" value={formData.location} onChange={handleInputChange} rows="2" required />
						</div>

						<div>
							<label>Description:</label>
							<textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
						</div>

						<div>
							<label>Total Lots:</label>
							<input type="number" name="total_lots" value={formData.total_lots} onChange={handleInputChange} min="0" />
						</div>

						<div>
							<label>Status:</label>
							<select name="status" value={formData.status} onChange={handleInputChange}>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>

						<button type="submit">{editingProperty ? "Update Property" : "Add Property"}</button>
						<button type="button" onClick={resetForm}>
							Cancel
						</button>
					</form>
				</div>
			)}

			<div>
				<h2>Property List</h2>
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Property Name</th>
							<th>Location</th>
							<th>Total Lots</th>
							<th>Status</th>
							<th>Created</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{properties.length === 0 ? (
							<tr>
								<td colSpan="7">No properties found</td>
							</tr>
						) : (
							properties.map((property) => (
								<tr key={property.property_id}>
									<td>{property.property_id}</td>
									<td>{property.property_name}</td>
									<td>{property.location}</td>
									<td>{property.total_lots}</td>
									<td>
										<span style={{ color: property.status === "active" ? "green" : "red" }}>{property.status.toUpperCase()}</span>
									</td>
									<td>{new Date(property.created_at).toLocaleDateString()}</td>
									<td>
										<button onClick={() => handleEdit(property)}>Edit</button>
										<button onClick={() => handleToggleStatus(property.property_id, property.status)}>{property.status === "active" ? "Deactivate" : "Activate"}</button>
										<button onClick={() => handleDelete(property.property_id)}>Delete</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default ManageProperties;
