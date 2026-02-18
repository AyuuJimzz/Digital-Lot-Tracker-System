import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./AccessDenied.css";

const AccessDenied = () => {
	const location = useLocation();
	const searchParams = new URLSearchParams(location.search);
	const status = searchParams.get("status") || "403";
	const message = searchParams.get("message") || "You do not have permission to access this page.";

	return (
		<div className="access-denied-container">
			<div className="access-denied-box">
				<div className="access-denied-icon">🔒</div>

				<div className="access-denied-status">Status: {status}</div>

				<div className="access-denied-message">{message}</div>

				<Link to="/" className="access-denied-btn">
					Go to Login
				</Link>
			</div>
		</div>
	);
};

export default AccessDenied;
