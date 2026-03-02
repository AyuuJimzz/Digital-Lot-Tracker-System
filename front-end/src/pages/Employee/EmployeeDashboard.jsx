import React, { useEffect, useState, useCallback } from "react";
import ForcePasswordChange from "../../components/ForcePasswordChange";

function EmployeeDashboard() {
	const [employees, setEmployees] = useState([]);
	const [loading, setLoading] = useState(true);
	// NEW: Track if the auth check is finished
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [showPasswordChange, setShowPasswordChange] = useState(false);

	useEffect(() => {
		// Check if password reset is required
		const passwordResetRequired = localStorage.getItem("password_reset_required");
		// Check for 'true', '1', or 1
		if (passwordResetRequired === "true" || passwordResetRequired === "1" || passwordResetRequired === 1) {
			setShowPasswordChange(true);
		}
	}, []);

	const handlePasswordChanged = () => {
		// Clear the flag and refresh the page
		localStorage.setItem("password_reset_required", "false");
		setShowPasswordChange(false);
		window.location.reload();
	};

	// Fetch employees
	const fetchEmployees = useCallback(() => {
		setLoading(true);
		fetch("http://localhost:5000/api/employees", {
			credentials: "include",
		})
			.then(async (res) => {
				if (!res.ok) {
					if (res.status === 403) window.location.href = "/forbidden";
					else if (res.status === 401) window.location.href = "/access-denied";
					const text = await res.text();
					throw new Error(text || "Failed to fetch employees");
				}
				return res.json();
			})
			.then((data) => {
				setEmployees(Array.isArray(data) ? data : data.employees || []);
				setLoading(false);
			})
			.catch((err) => {
				console.error("Fetch error:", err);
				setLoading(false);
			});
	}, []);

	// Check session
	useEffect(() => {
		fetch("http://localhost:5000/api/auth/check-session", {
			credentials: "include",
		})
			.then(async (res) => {
				if (!res.ok) {
					window.location.href = "/access-denied";
					throw new Error("Not logged in");
				}
				return res.json();
			})
			.then((data) => {
				if (data.role !== "employee" && data.role !== "admin") {
					window.location.href = "/forbidden";
				} else {
					// NEW: Only set authorized to true after checking role
					setIsAuthorized(true);
					fetchEmployees();
				}
			})
			.catch(() => {
				window.location.href = "/access-denied";
			});
	}, [fetchEmployees]);

	const handleLogout = async () => {
		await fetch("http://localhost:5000/api/auth/logout", {
			method: "POST",
			credentials: "include",
		});
		window.location.href = "/";
	};

	const handleAddEmployee = async () => {
		const response = await fetch("http://localhost:5000/api/employees", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				first_name: "New",
				last_name: "Employee",
				email: `new${Date.now()}@example.com`,
				password: "123456",
			}),
		});

		if (response.ok) fetchEmployees();
		else if (response.status === 403) window.location.href = "/forbidden";
		else console.error("Failed to add employee");
	};

	// NEW: Prevent the structure from rendering until authorized
	if (!isAuthorized) {
		return null; // Or a simple loading spinner
	}

	return (
		<div className="min-h-screen bg-gray-100 font-sans">
			{/* Force Password Change Modal */}
			{showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

			{/* Header */}
			<header className="bg-white flex justify-between items-center px-10 py-5 shadow-md">
				<h1 className="text-2xl font-bold text-blue-500">👤 Golden Dragon Estate - Employee</h1>
				<button onClick={handleLogout} className="bg-red-600 text-white px-5 py-2 rounded-md text-sm transition-colors duration-300 hover:bg-red-700">
					Logout
				</button>
			</header>

			{/* Main Content */}
			<main className="max-w-[1200px] mx-auto p-10">
				{/* Stats Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-5 mb-10">
					<div className="bg-white p-8 rounded-lg text-center shadow-md transition-transform duration-200 hover:-translate-y-1">
						<h3 className="text-gray-600 text-sm font-normal mb-2">Total Employees</h3>
						<p className="text-blue-500 text-5xl font-bold">{loading ? "Loading..." : employees.length}</p>
					</div>
				</div>

				{/* Actions */}
				<div className="bg-white p-8 rounded-lg shadow-md flex flex-wrap gap-3">
					<button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">View Available Lots</button>
					<button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">Add Client</button>
					<button onClick={handleAddEmployee} className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">
						Add Employee (Test)
					</button>
					<button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">Record Sale</button>
					<button className="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold transition-all duration-300 hover:bg-blue-700 hover:scale-105">My Reports</button>
				</div>
			</main>
		</div>
	);
}

export default EmployeeDashboard;
