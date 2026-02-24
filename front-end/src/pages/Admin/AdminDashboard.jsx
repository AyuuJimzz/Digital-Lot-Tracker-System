import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

function AdminDashboard() {
	const navigate = useNavigate();
	const stats = [
		{ title: "Properties", count: 0 },
		{ title: "Available Lots", count: 0 },
		{ title: "Sold Lots", count: 0 },
		{ title: "Employees", count: 1 },
	]; 

	const actions = ["Manage Properties", "Manage Employees","View Lots",  "Reports"];

	const handleActionClick = (action) => {
		if (action === "Manage Employees") {
			navigate("/manage-employees");
		} else if (action === "Manage Properties") {
			navigate("/manage-properties");
		}
	};

	useEffect(() => {
		fetch("http://localhost:5000/api/auth/check-session", {
			credentials: "include",
		})
			.then((res) => {
				if (!res.ok) throw new Error("Not logged in");
				return res.json();
			})
			.then((data) => {
				if (data.role !== "admin") {
					alert("Access denied. Please log in as admin.");
					window.location.href = "/";
				}
			})
			.catch(() => {
				alert("Please log in first");
				window.location.href = "/";
			});
	}, []);

	const handleLogout = async () => {
		await fetch("http://localhost:5000/api/auth/logout", {
			method: "POST",
			credentials: "include",
		});
		window.location.href = "/";
	};

	return (
		<div className="dashboard">
			<header>
				<h1>🏛️ Golden Dragon Estate</h1>
				<button onClick={handleLogout}>Logout</button>
			</header>

			<main>
				<div className="stats">
					{stats.map((stat, i) => (
						<div key={i} className="card">
							<h3>{stat.title}</h3>
							<p>{stat.count}</p>
						</div>
					))}
				</div>

				<div className="actions">
					{actions.map((action, i) => (
						<button key={i} onClick={() => handleActionClick(action)}>
							{action}
						</button>
					))}
				</div>
			</main>
		</div>
	);
}

export default AdminDashboard;
