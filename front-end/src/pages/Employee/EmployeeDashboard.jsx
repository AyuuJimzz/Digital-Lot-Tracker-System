import React, { useEffect, useState } from "react";
import axios from "axios";

import StatCard from "../../components/admin/StatCard";
import EmployeeTransactions from "../../components/employee/EmployeeRecentTransactions";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const EmployeeDashboard = () => {
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [showPasswordChange, setShowPasswordChange] = useState(false);

	useEffect(() => {
		axios
			.get("http://localhost:5000/api/auth/check-session", {
				withCredentials: true,
			})
			.then((response) => {
				if (response.data.role !== "employee" && response.data.role !== "admin") {
					window.location.href = "/forbidden";
					return;
				}
				setIsAuthorized(true);
			})
			.catch(() => {
				window.location.href = "/access-denied";
			});
	}, []);

	useEffect(() => {
		const passwordResetRequired = localStorage.getItem("password_reset_required");
		if (passwordResetRequired === "true" || passwordResetRequired === "1" || passwordResetRequired === 1) {
			setShowPasswordChange(true);
		}
	}, []);

	const handlePasswordChanged = () => {
		localStorage.setItem("password_reset_required", "false");
		setShowPasswordChange(false);
		window.location.reload();
	};

	if (!isAuthorized) return null;

	return (
		<div className="space-y-6 p-6">
			{showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

			<div>
				<h1 className="text-2xl font-bold text-foreground tracking-tight">Employee Dashboard</h1>
				<p className="text-sm text-gray-500 mt-2">This page is under development.</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<StatCard title="My Assigned Lots" value="0" />
				<StatCard title="My Sales" value="0" />
				<StatCard title="Pending Tasks" value="0" />
			</div>

			<div className="pt-2">
				<EmployeeTransactions />
			</div>
		</div>
	);
};

export default EmployeeDashboard;
