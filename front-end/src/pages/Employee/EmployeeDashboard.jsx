import React, { useState, useEffect } from "react";
import StatCard from "../../components/admin/StatCard";
import EmployeeTransactions from "../../components/employee/EmployeeRecentTransactions";
import ForcePasswordChange from "../../components/ForcePasswordChange";

const EmployeeDashboard = () => {
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

	return (
		<div className="space-y-6">
			{/* Force Password Change Modal */}
			{showPasswordChange && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}

			{/* Page Title */}
			<div>
				<h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
			</div>
			{/* Top Row Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<StatCard title="Properties Assigned" value="5" />
				<StatCard title="Total Sales" value="8" />
				<StatCard title="Sales Revenue" value="₱3.2M" />
			</div>

			{/* Secondary Row Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<StatCard title="Pending Sales" value="2" />
				<StatCard title="Completed Sales" value="6" />
			</div>

			{/* Recent Sales Table */}
			<div className="pt-2">
				<EmployeeTransactions />
			</div>
		</div>
	);
};

export default EmployeeDashboard;
