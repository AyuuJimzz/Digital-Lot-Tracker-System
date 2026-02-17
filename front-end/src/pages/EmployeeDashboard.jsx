import React from "react";
import "./EmployeeDashboard.css";

function EmployeeDashboard() {
	const stats = [
		{ title: "My Sales", count: 0 },
		{ title: "Available Lots", count: 0 },
		{ title: "Pending Sales", count: 0 },
		{ title: "My Clients", count: 0 },
	];

	const actions = ["View Available Lots", "Add Client", "Record Sale", "My Reports"];

	const handleLogout = () => {
		localStorage.removeItem("token");
		window.location.href = "/";
	};

	return (
		<div className="dashboard">
			<header>
				<h1>👤 Golden Dragon Estate - Employee</h1>
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

export default EmployeeDashboard;
