import { API_BASE_URL } from "../config/api";
import React, { useState, useEffect } from "react";
import axios from "axios";
import AccessDenied from "../view/AccessDenied";

const ProtectedRoute = ({ children, allowedRoles }) => {
	const rolesKey = Array.isArray(allowedRoles) ? allowedRoles.join(",") : "";
	const allowedRolesList = rolesKey ? rolesKey.split(",") : [];

	const [auth, setAuth] = useState(() => {
		const initialToken = localStorage.getItem("authToken");
		const initialRole = localStorage.getItem("role");
		const isRoleValid = !allowedRolesList.length || (initialRole && allowedRolesList.includes(initialRole));
		const isLocallyAuthorized = Boolean(initialToken && isRoleValid);

		return {
			loading: !isLocallyAuthorized,
			isAuthorized: isLocallyAuthorized,
			isAuthenticated: Boolean(initialToken),
		};
	});

	useEffect(() => {
		// Restore saved JWT token for cross-origin deployments (Vercel + Render)
		const savedToken = localStorage.getItem("authToken");
		const headers = {};
		if (savedToken) {
			headers["Authorization"] = `Bearer ${savedToken}`;
			axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
		}

		axios
			.get(`${API_BASE_URL}/api/auth/check-session`, {
				headers,
				withCredentials: true,
			})
			.then((response) => {
				if (response.data && response.data.authenticated) {
					localStorage.setItem("role", response.data.role || "");
					localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
					const roles = rolesKey ? rolesKey.split(",") : [];
					const hasRole = roles.length > 0 ? roles.includes(response.data.role) : true;
					setAuth({ loading: false, isAuthorized: hasRole, isAuthenticated: true });
				} else {
					localStorage.removeItem("authToken");
					localStorage.removeItem("role");
					setAuth({ loading: false, isAuthorized: false, isAuthenticated: false });
				}
			})
			.catch(() => {
				localStorage.removeItem("authToken");
				localStorage.removeItem("role");
				setAuth({ loading: false, isAuthorized: false, isAuthenticated: false });
			});
	}, [rolesKey]);

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
