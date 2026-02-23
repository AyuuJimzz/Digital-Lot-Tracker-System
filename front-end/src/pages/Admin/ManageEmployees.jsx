import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const ManageEmployees = () => {
	// ============================================================
	// STATE MANAGEMENT
	// ============================================================
	const [employees, setEmployees] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingEmployee, setEditingEmployee] = useState(null);
	const [formData, setFormData] = useState({
		first_name: "",
		last_name: "",
		email: "",
		password: "",
		date_of_birth: "",
		gender: "",
		phone_number: "",
		address: "",
	});

	const navigate = useNavigate();

	// ============================================================
	// FETCH EMPLOYEES - Get all employees from API
	// ============================================================
	const fetchEmployees = useCallback(async () => {
		try {
			const response = await fetch("http://localhost:5000/api/employees", {
				credentials: "include",
			});

			if (response.status === 401 || response.status === 403) {
				navigate("/access-denied?status=401&message=Unauthorized");
				return;
			}

			if (!response.ok) {
				throw new Error("Failed to fetch employees");
			}

			const data = await response.json();
			setEmployees(data);
			setLoading(false);
		} catch (err) {
			setError(err.message);
			setLoading(false);
		}
	}, [navigate]);

	useEffect(() => {
		fetchEmployees();
	}, [fetchEmployees]);

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

	const handleSubmit = async (e) => {
		e.preventDefault();

		try {
			const url = editingEmployee ? `http://localhost:5000/api/employees/${editingEmployee.employee_id}` : "http://localhost:5000/api/employees";

			const method = editingEmployee ? "PUT" : "POST";
			const body = editingEmployee ? { ...formData } : { ...formData };

			const response = await fetch(url, {
				method: method,
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to save employee");
			}

			await fetchEmployees();
			resetForm();
			alert(editingEmployee ? "Employee updated successfully" : "Employee added successfully");
		} catch (err) {
			alert(err.message);
		}
	};

	const handleEdit = (employee) => {
		setEditingEmployee(employee);
		setFormData({
			first_name: employee.first_name,
			last_name: employee.last_name,
			email: employee.email,
			password: "",
			date_of_birth: employee.date_of_birth ? employee.date_of_birth.split("T")[0] : "",
			gender: employee.gender || "",
			phone_number: employee.phone_number || "",
			address: employee.address || "",
		});
		setShowForm(true);
	};

	// ============================================================
	// DELETE EMPLOYEE - Remove employee from database
	// ============================================================
	const handleDelete = async (employeeId) => {
		if (!window.confirm("Are you sure you want to delete this employee?")) {
			return;
		}

		try {
			const response = await fetch(`http://localhost:5000/api/employees/${employeeId}`, {
				method: "DELETE",
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to delete employee");
			}

			await fetchEmployees();
			alert("Employee deleted successfully");
		} catch (err) {
			alert(err.message);
		}
	};

	const resetForm = () => {
		setFormData({
			first_name: "",
			last_name: "",
			email: "",
			password: "",
			date_of_birth: "",
			gender: "",
			phone_number: "",
			address: "",
		});
		setEditingEmployee(null);
		setShowForm(false);
	};

	// ============================================================
	// RENDER UI
	// ============================================================
	if (loading) {
		return <div>Loading employees...</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	return (
		<div>
			<h1>Manage Employees</h1>

			<button onClick={() => navigate("/admin-panel")}>Back to Dashboard</button>

			<button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Add New Employee"}</button>

			{showForm && (
				<div>
					<h2>{editingEmployee ? "Edit Employee" : "Add New Employee"}</h2>
					<form onSubmit={handleSubmit}>
						<div>
							<label>First Name:</label>
							<input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
						</div>

						<div>
							<label>Last Name:</label>
							<input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
						</div>

						<div>
							<label>Email:</label>
							<input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
						</div>

						{!editingEmployee && (
							<div>
								<label>Password:</label>
								<input type="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingEmployee} />
							</div>
						)}

						<div>
							<label>Date of Birth:</label>
							<input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} />
						</div>

						<div>
							<label>Gender:</label>
							<select name="gender" value={formData.gender} onChange={handleInputChange}>
								<option value="">Select Gender</option>
								<option value="Male">Male</option>
								<option value="Female">Female</option>
								<option value="Other">Other</option>
							</select>
						</div>

						<div>
							<label>Phone Number:</label>
							<input type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} />
						</div>

						<div>
							<label>Address:</label>
							<textarea name="address" value={formData.address} onChange={handleInputChange} rows="3" />
						</div>

						<button type="submit">{editingEmployee ? "Update Employee" : "Add Employee"}</button>
						<button type="button" onClick={resetForm}>
							Cancel
						</button>
					</form>
				</div>
			)}

			<div>
				<h2>Employee List</h2>
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>First Name</th>
							<th>Last Name</th>
							<th>Email</th>
							<th>Phone</th>
							<th>Gender</th>
							<th>Date of Birth</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{employees.length === 0 ? (
							<tr>
								<td colSpan="8">No employees found</td>
							</tr>
						) : (
							employees.map((employee) => (
								<tr key={employee.employee_id}>
									<td>{employee.employee_id}</td>
									<td>{employee.first_name}</td>
									<td>{employee.last_name}</td>
									<td>{employee.email}</td>
									<td>{employee.phone_number || "N/A"}</td>
									<td>{employee.gender || "N/A"}</td>
									<td>{employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : "N/A"}</td>
									<td>
										<button onClick={() => handleEdit(employee)}>Edit</button>
										<button onClick={() => handleDelete(employee.employee_id)}>Delete</button>
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

export default ManageEmployees;
