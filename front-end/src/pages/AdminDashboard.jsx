import React from "react";
import "./AdminDashboard.css";

function AdminDashboard() {
	const stats = [
		{ title: "Properties", count: 0 },
		{ title: "Available Lots", count: 0 },
		{ title: "Sold Lots", count: 0 },
		{ title: "Employees", count: 1 },
	];

	const actions = ["Add Property", "View Lots", "Manage Employees", "Reports"];

	const handleLogout = () => {
		localStorage.removeItem("token");
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
						<button key={i}>{action}</button>
					))}
				</div>
			</main>
		</div>
	);
}

export default AdminDashboard;
