import { API_BASE_URL } from "../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";
import AccessDenied from "../view/AccessDenied";

const ProtectedRoute = ({ children, allowedRoles }) => {
	const [auth, setAuth] = useState({ loading: true, isAuthorized: false });

	useEffect(() => {
		// Restore saved JWT token for cross-origin deployments (Vercel + Render)
		const savedToken = localStorage.getItem("authToken");
		if (savedToken) {
			axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
		}
		axios
			.get(`${API_BASE_URL}/api/auth/check-session`, {
				withCredentials: true,
			})
			.then((response) => {
				if (response.data.authenticated && allowedRoles.includes(response.data.role)) {
					localStorage.setItem("role", response.data.role || "");
					localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
					setAuth({ loading: false, isAuthorized: true });
				} else {
					setAuth({ loading: false, isAuthorized: false });
				}
			})
			.catch(() => {
				setAuth({ loading: false, isAuthorized: false });
			});
	}, [allowedRoles]);

	if (auth.loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				<span className="ml-3 text-gray-600 font-medium">Verifying Session...</span>
			</div>
		);
	}

	if (!auth.isAuthorized) {
		return <AccessDenied />;
	}

	return children;
};

export default ProtectedRoute;
