// Protected Route Guard: Smooth redirect for unauthenticated visitors and maintenance mode (Vercel & Render verified)
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { WifiOff, RotateCw, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "../config/api";
import AccessDenied from "../view/AccessDenied";
import { clearStoredAuth, getStoredToken } from "../utils/authStorage";

const ProtectedRoute = ({ children, allowedRoles }) => {
	const [retryCount, setRetryCount] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);
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
			connectionError: false,
		};
	});

	// Auto-retry when network connection is restored
	useEffect(() => {
		const handleOnline = () => {
			setRetryCount((c) => c + 1);
		};
		window.addEventListener("online", handleOnline);
		return () => {
			window.removeEventListener("online", handleOnline);
		};
	}, []);

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
				setIsRetrying(false);
				if (getStoredToken() !== savedToken) {
					setRetryCount((current) => current + 1);
					return;
				}
				if (response.data && response.data.authenticated) {
					localStorage.setItem("role", response.data.role || "");
					localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
					const roles = rolesKey ? rolesKey.split(",") : [];
					const hasRole = roles.length > 0 ? roles.includes(response.data.role) : true;
					setAuth({
						loading: false,
						isAuthorized: hasRole,
						isAuthenticated: true,
						isMaintenance: false,
						connectionError: false,
					});
				} else {
					clearStoredAuth(savedToken);
					setAuth({
						loading: false,
						isAuthorized: false,
						isAuthenticated: false,
						isMaintenance: false,
						connectionError: false,
					});
				}
			})
			.catch((error) => {
				if (cancelled) return;
				setIsRetrying(false);
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
						connectionError: false,
					});
					return;
				}

				// Confirmed authentication rejection (invalid/expired JWT or logged in elsewhere)
				const isAuthFailure = error.response?.status === 401 || error.response?.status === 403;
				if (isAuthFailure) {
					clearStoredAuth(savedToken);
					setAuth({
						loading: false,
						isAuthorized: false,
						isAuthenticated: false,
						isMaintenance: false,
						connectionError: false,
					});
					return;
				}

				// Network drop, connection timeout, cold start, or 5xx server error:
				// DO NOT clear stored auth! Session credentials remain safely preserved.
				const rolesList = rolesKey ? rolesKey.split(",") : [];
				const currentRole = localStorage.getItem("role");
				const isRoleValid = !rolesList.length || (currentRole && rolesList.includes(currentRole));
				const hasValidLocalSession = Boolean(savedToken && isRoleValid);

				if (hasValidLocalSession) {
					// User was already in an authorized session: keep them in the app with connection indicator
					setAuth((prev) => ({
						...prev,
						loading: false,
						isAuthorized: true,
						isAuthenticated: true,
						isMaintenance: false,
						connectionError: true,
					}));
				} else {
					// Fresh entry that could not verify session due to network: show retry screen instead of destroying session
					setAuth({
						loading: false,
						isAuthorized: false,
						isAuthenticated: Boolean(savedToken),
						isMaintenance: false,
						connectionError: true,
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [rolesKey, retryCount]);

	if (auth.loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				<span className="ml-3 text-gray-600 font-medium dark:text-slate-300">Verifying Session...</span>
			</div>
		);
	}

	// 1. If maintenance mode is active, smoothly navigate to /maintenance
	if (auth.isMaintenance) {
		return <Navigate to="/maintenance" replace />;
	}

	// 2. If connection dropped and user cannot be authorized initially, show reconnect screen
	if (!auth.isAuthorized && auth.connectionError) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50 px-4 dark:bg-slate-900">
				<div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl text-center dark:border-amber-500/30 dark:bg-slate-800">
					<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
						<WifiOff className="h-7 w-7" aria-hidden="true" />
					</div>
					<h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
						Connection Interrupted
					</h2>
					<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
						Unable to reach the server. Your session is safely preserved. Please check your internet connection and try again.
					</p>
					<div className="mt-6 flex flex-col sm:flex-row gap-3">
						<button
							type="button"
							disabled={isRetrying}
							onClick={() => {
								setIsRetrying(true);
								setAuth((prev) => ({ ...prev, loading: true, connectionError: false }));
								setRetryCount((c) => c + 1);
							}}
							className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-75 cursor-pointer"
						>
							<RotateCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
							{isRetrying ? "Reconnecting..." : "Retry Connection"}
						</button>
						<button
							type="button"
							onClick={() => {
								clearStoredAuth();
								setAuth({
									loading: false,
									isAuthorized: false,
									isAuthenticated: false,
									isMaintenance: false,
									connectionError: false,
								});
							}}
							className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
						>
							Sign In Again
						</button>
					</div>
				</div>
			</div>
		);
	}

	// 3. If unauthenticated visitor directly browses to a protected route, smoothly redirect to login
	if (!auth.isAuthenticated) {
		return <Navigate to="/" replace />;
	}

	// 4. If authenticated user tries to visit a route outside their permitted role, show Access Denied
	if (!auth.isAuthorized) {
		return <AccessDenied />;
	}

	return (
		<>
			{auth.connectionError && (
				<div
					role="status"
					aria-live="polite"
					className="fixed top-0 left-0 right-0 z-[99999] bg-amber-500 text-slate-950 px-4 py-2 text-center text-xs font-semibold shadow-md flex items-center justify-center gap-2"
				>
					<AlertTriangle className="h-4 w-4 shrink-0" />
					<span>Slow connection or offline. Your login session is preserved.</span>
					<button
						type="button"
						onClick={() => setRetryCount((c) => c + 1)}
						className="underline font-bold hover:text-black cursor-pointer ml-1 inline-flex items-center gap-1"
					>
						<RotateCw className="h-3 w-3" />
						Retry
					</button>
				</div>
			)}
			{children}
		</>
	);
};

export default ProtectedRoute;
