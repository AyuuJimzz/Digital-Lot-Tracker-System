// Protected Route Guard: Smooth redirect for unauthenticated visitors and maintenance mode (Vercel & Render verified)
import { API_BASE_URL } from "../config/api";
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import AccessDenied from "../view/AccessDenied";
import { clearStoredAuth, getStoredToken } from "../utils/authStorage";

const ProtectedRoute = ({ children, allowedRoles }) => {
	const [retryCount, setRetryCount] = useState(0);
	const rolesKey = Array.isArray(allowedRoles) ? allowedRoles.join(",") : "";
	const allowedRolesList = rolesKey ? rolesKey.split(",") : [];

	const [auth, setAuth] = useState(() => {
		const initialToken = getStoredToken();
		const initialRole = localStorage.getItem("role");
		const isRoleValid = !allowedRolesList.length || (initialRole && allowedRolesList.includes(initialRole));
		const isLocallyAuthorized = Boolean(initialToken && isRoleValid);

		return {
			loading: !isLocallyAuthorized,
			isAuthorized: isLocallyAuthorized,
			isAuthenticated: Boolean(initialToken),
			isMaintenance: false,
		};
	});

	useEffect(() => {
		let cancelled = false;
		// Restore saved JWT token for cross-origin deployments (Vercel + Render)
		const savedToken = getStoredToken();
		const headers = { Authorization: savedToken ? `Bearer ${savedToken}` : null };
		if (savedToken) {
			axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
		}

		axios
			.get(`${API_BASE_URL}/api/auth/check-session`, {
				headers,
				withCredentials: true,
				timeout: 15000,
			})
			.then((response) => {
				if (cancelled) return;
				if (getStoredToken() !== savedToken) {
					setRetryCount((current) => current + 1);
					return;
				}
				if (response.data && response.data.authenticated) {
					localStorage.setItem("role", response.data.role || "");
					localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
					const roles = rolesKey ? rolesKey.split(",") : [];
					const hasRole = roles.length > 0 ? roles.includes(response.data.role) : true;
					setAuth({ loading: false, isAuthorized: hasRole, isAuthenticated: true, isMaintenance: false });
				} else {
					clearStoredAuth(savedToken);
					setAuth({ loading: false, isAuthorized: false, isAuthenticated: false, isMaintenance: false });
				}
			})
			.catch((error) => {
				if (cancelled) return;
				if (getStoredToken() !== savedToken) {
					setRetryCount((current) => current + 1);
					return;
				}

				// If system is in maintenance mode, redirect smoothly to /maintenance
				if (error.response?.status === 503 && error.response?.data?.maintenance) {
					setAuth({
						loading: false,
						isAuthorized: false,
						isAuthenticated: false,
						isMaintenance: true,
					});
					return;
				}

				// Any other error (unauthorized, expired session, network drop):
				// Cleanly clear stored auth and redirect to login page without ugly error screens
				clearStoredAuth(savedToken);
				setAuth({
					loading: false,
					isAuthorized: false,
					isAuthenticated: false,
					isMaintenance: false,
				});
			});
		return () => { cancelled = true; };
	}, [rolesKey, retryCount]);

	if (auth.loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				<span className="ml-3 text-gray-600 font-medium">Verifying Session...</span>
			</div>
		);
	}

	// 1. If maintenance mode is active, smoothly navigate to /maintenance
	if (auth.isMaintenance) {
		return <Navigate to="/maintenance" replace />;
	}

	// 2. If unauthenticated visitor directly browses to a protected route, smoothly redirect to login
	if (!auth.isAuthenticated) {
		return <Navigate to="/" replace />;
	}

	// 3. If authenticated user tries to visit a route outside their permitted role, show Access Denied
	if (!auth.isAuthorized) {
		return <AccessDenied />;
	}

	return children;
};

export default ProtectedRoute;
