import { API_BASE_URL } from "../config/api";
import React, { useState, useEffect } from "react";
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
					setAuth({ loading: false, isAuthorized: hasRole, isAuthenticated: true });
				} else {
					clearStoredAuth(savedToken);
					setAuth({ loading: false, isAuthorized: false, isAuthenticated: false });
				}
			})
			.catch((error) => {
				if (cancelled) return;
				if (getStoredToken() !== savedToken) {
					setRetryCount((current) => current + 1);
					return;
				}
				if (error.response?.status === 401 || error.response?.status === 403) {
					clearStoredAuth(savedToken);
					setAuth({ loading: false, isAuthorized: false, isAuthenticated: false });
					return;
				}

				let friendlyError = "Session verification failed. Please try again or sign in.";
				if (error.code === "ECONNABORTED" || error.message?.toLowerCase().includes("timeout")) {
					friendlyError = "Connection timed out. The server is taking longer than expected to respond. Please check your internet or click Retry.";
				} else if (error.code === "ERR_NETWORK" || !error.response) {
					friendlyError = "Unable to reach the server. Please check your internet connection.";
				}

				setAuth({
					loading: false,
					isAuthorized: false,
					isAuthenticated: Boolean(savedToken),
					error: friendlyError,
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

	if (auth.error) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50 p-6">
				<div className="max-w-md text-center">
					<p className="font-medium text-red-700">{auth.error}</p>
					<button className="mt-4 rounded bg-blue-600 px-4 py-2 text-white" onClick={() => {
						setAuth((current) => ({ ...current, loading: true, error: null }));
						setRetryCount((current) => current + 1);
					}}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!auth.isAuthorized) {
		return <AccessDenied />;
	}

	return children;
};

export default ProtectedRoute;
